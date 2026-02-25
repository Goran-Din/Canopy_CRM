import { queryDb } from '../../config/database.js';
import type { SyncLogQuery } from './schema.js';

// ======== Row Types ========

export interface IntegrationConfigRow {
  id: string; tenant_id: string; provider: string;
  status: string; config_data: Record<string, unknown>;
  access_token_encrypted: string | null; refresh_token_encrypted: string | null;
  token_expires_at: string | null; last_sync_at: string | null;
  last_error: string | null; webhook_secret: string | null;
  created_by: string | null; updated_by: string | null;
  created_at: string; updated_at: string;
}

export interface SyncLogRow {
  id: string; tenant_id: string; provider: string;
  direction: string; entity_type: string; entity_id: string;
  external_id: string | null; status: string;
  error_message: string | null; request_payload: unknown;
  response_payload: unknown; duration_ms: number | null;
  created_at: string;
}

interface CountRow { count: string; }

// ======== Integration Configs ========

export async function findAllConfigs(tenantId: string): Promise<IntegrationConfigRow[]> {
  const res = await queryDb<IntegrationConfigRow>(
    `SELECT * FROM integration_configs WHERE tenant_id = $1 ORDER BY provider`, [tenantId],
  );
  return res.rows;
}

export async function findConfigByProvider(tenantId: string, provider: string): Promise<IntegrationConfigRow | null> {
  const res = await queryDb<IntegrationConfigRow>(
    `SELECT * FROM integration_configs WHERE tenant_id = $1 AND provider = $2`, [tenantId, provider],
  );
  return res.rows[0] || null;
}

export async function upsertConfig(
  tenantId: string, provider: string, data: Record<string, unknown>, userId: string,
): Promise<IntegrationConfigRow> {
  const res = await queryDb<IntegrationConfigRow>(
    `INSERT INTO integration_configs (tenant_id, provider, config_data, webhook_secret, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $5)
     ON CONFLICT (tenant_id, provider)
     DO UPDATE SET config_data = COALESCE($3, integration_configs.config_data),
                   webhook_secret = COALESCE($4, integration_configs.webhook_secret),
                   updated_by = $5
     RETURNING *`,
    [tenantId, provider, JSON.stringify(data.config_data || {}),
     data.webhook_secret || null, userId],
  );
  return res.rows[0];
}

export async function updateConfigStatus(
  tenantId: string, provider: string, status: string, extra?: Record<string, unknown>,
): Promise<IntegrationConfigRow | null> {
  const sets = ['status = $1']; const params: unknown[] = [status]; let pi = 2;
  if (extra) {
    for (const [col, val] of Object.entries(extra)) {
      sets.push(`${col} = $${pi}`); params.push(val ?? null); pi++;
    }
  }
  params.push(tenantId); params.push(provider);
  const res = await queryDb<IntegrationConfigRow>(
    `UPDATE integration_configs SET ${sets.join(', ')} WHERE tenant_id = $${pi-1} AND provider = $${pi} RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

export async function updateTokens(
  tenantId: string, provider: string,
  accessToken: string, refreshToken: string, expiresAt: string,
): Promise<void> {
  await queryDb(
    `UPDATE integration_configs
     SET access_token_encrypted = $1, refresh_token_encrypted = $2,
         token_expires_at = $3, status = 'active'
     WHERE tenant_id = $4 AND provider = $5`,
    [accessToken, refreshToken, expiresAt, tenantId, provider],
  );
}

export async function updateLastSync(tenantId: string, provider: string): Promise<void> {
  await queryDb(
    `UPDATE integration_configs SET last_sync_at = NOW() WHERE tenant_id = $1 AND provider = $2`,
    [tenantId, provider],
  );
}

export async function updateLastError(tenantId: string, provider: string, error: string): Promise<void> {
  await queryDb(
    `UPDATE integration_configs SET last_error = $1, status = 'error' WHERE tenant_id = $2 AND provider = $3`,
    [error, tenantId, provider],
  );
}

export async function deleteConfig(tenantId: string, provider: string): Promise<IntegrationConfigRow | null> {
  const res = await queryDb<IntegrationConfigRow>(
    `DELETE FROM integration_configs WHERE tenant_id = $1 AND provider = $2 RETURNING *`,
    [tenantId, provider],
  );
  return res.rows[0] || null;
}

// ======== Sync Log ========

export async function createSyncLog(
  tenantId: string, provider: string, direction: string,
  entityType: string, entityId: string,
): Promise<SyncLogRow> {
  const res = await queryDb<SyncLogRow>(
    `INSERT INTO integration_sync_log (tenant_id, provider, direction, entity_type, entity_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [tenantId, provider, direction, entityType, entityId],
  );
  return res.rows[0];
}

export async function updateSyncLog(
  logId: string, status: string, externalId?: string | null,
  errorMessage?: string | null, requestPayload?: unknown,
  responsePayload?: unknown, durationMs?: number,
): Promise<void> {
  await queryDb(
    `UPDATE integration_sync_log
     SET status = $1, external_id = COALESCE($2, external_id),
         error_message = $3, request_payload = $4,
         response_payload = $5, duration_ms = $6
     WHERE id = $7`,
    [status, externalId || null, errorMessage || null,
     requestPayload ? JSON.stringify(requestPayload) : null,
     responsePayload ? JSON.stringify(responsePayload) : null,
     durationMs ?? null, logId],
  );
}

export async function findSyncLogs(tenantId: string, query: SyncLogQuery): Promise<{ rows: SyncLogRow[]; total: number }> {
  const conds: string[] = ['l.tenant_id = $1'];
  const params: unknown[] = [tenantId];
  let pi = 2;
  if (query.provider) { conds.push(`l.provider = $${pi}`); params.push(query.provider); pi++; }
  if (query.entity_type) { conds.push(`l.entity_type = $${pi}`); params.push(query.entity_type); pi++; }
  if (query.status) { conds.push(`l.status = $${pi}`); params.push(query.status); pi++; }
  const where = conds.join(' AND ');
  const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;
  const cnt = await queryDb<CountRow>(`SELECT COUNT(*) AS count FROM integration_sync_log l WHERE ${where}`, params);
  const total = parseInt(cnt.rows[0].count, 10);
  const data = await queryDb<SyncLogRow>(
    `SELECT l.* FROM integration_sync_log l WHERE ${where} ORDER BY l.created_at ${dir} LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );
  return { rows: data.rows, total };
}

export async function findSyncLogsByEntity(tenantId: string, entityId: string): Promise<SyncLogRow[]> {
  const res = await queryDb<SyncLogRow>(
    `SELECT * FROM integration_sync_log WHERE tenant_id = $1 AND entity_id = $2 ORDER BY created_at DESC`,
    [tenantId, entityId],
  );
  return res.rows;
}
