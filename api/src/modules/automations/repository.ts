import { queryDb } from '../../config/database.js';

// === Interfaces ===

export interface AutomationConfig {
  id: string;
  tenant_id: string;
  automation_type: string;
  is_enabled: boolean;
  template_id: string | null;
  delay_minutes: number;
  send_via: string;
  max_repeats: number;
  repeat_interval_days: number;
  conditions: Record<string, unknown>;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AutomationLogEntry {
  id: string;
  tenant_id: string;
  automation_type: string;
  job_id: string | null;
  customer_id: string | null;
  invoice_id: string | null;
  quote_id: string | null;
  channel: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  message_subject: string | null;
  message_preview: string | null;
  status: string;
  failure_reason: string | null;
  attempt_number: number;
  sent_at: Date;
}

interface CountRow { count: string }

// === Automation Configs ===

export async function getConfig(
  tenantId: string,
  automationType: string,
): Promise<AutomationConfig | null> {
  const result = await queryDb<AutomationConfig>(
    `SELECT * FROM automation_configs
     WHERE tenant_id = $1 AND automation_type = $2`,
    [tenantId, automationType],
  );
  return result.rows[0] || null;
}

export async function getAllConfigs(
  tenantId: string,
): Promise<AutomationConfig[]> {
  const result = await queryDb<AutomationConfig>(
    `SELECT * FROM automation_configs
     WHERE tenant_id = $1
     ORDER BY automation_type ASC`,
    [tenantId],
  );
  return result.rows;
}

export async function updateConfig(
  tenantId: string,
  automationType: string,
  data: Record<string, unknown>,
): Promise<AutomationConfig> {
  // Upsert: insert or update
  const result = await queryDb<AutomationConfig>(
    `INSERT INTO automation_configs
     (tenant_id, automation_type, is_enabled, template_id, delay_minutes,
      send_via, max_repeats, repeat_interval_days, conditions, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (tenant_id, automation_type)
     DO UPDATE SET
       is_enabled = COALESCE($3, automation_configs.is_enabled),
       template_id = COALESCE($4, automation_configs.template_id),
       delay_minutes = COALESCE($5, automation_configs.delay_minutes),
       send_via = COALESCE($6, automation_configs.send_via),
       max_repeats = COALESCE($7, automation_configs.max_repeats),
       repeat_interval_days = COALESCE($8, automation_configs.repeat_interval_days),
       conditions = COALESCE($9, automation_configs.conditions),
       updated_by = $10
     RETURNING *`,
    [
      tenantId,
      automationType,
      data.is_enabled ?? false,
      data.template_id ?? null,
      data.delay_minutes ?? 0,
      data.send_via ?? 'both',
      data.max_repeats ?? 1,
      data.repeat_interval_days ?? 7,
      data.conditions ? JSON.stringify(data.conditions) : '{}',
      data.updated_by ?? null,
    ],
  );
  return result.rows[0];
}

// === Automation Log (APPEND-ONLY) ===

export async function insertLog(
  data: Record<string, unknown>,
): Promise<AutomationLogEntry> {
  const result = await queryDb<AutomationLogEntry>(
    `INSERT INTO automation_log
     (tenant_id, automation_type, job_id, customer_id, invoice_id, quote_id,
      channel, recipient_email, recipient_phone, message_subject, message_preview,
      status, failure_reason, attempt_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      data.tenant_id,
      data.automation_type,
      data.job_id ?? null,
      data.customer_id ?? null,
      data.invoice_id ?? null,
      data.quote_id ?? null,
      data.channel ?? 'email',
      data.recipient_email ?? null,
      data.recipient_phone ?? null,
      data.message_subject ?? null,
      data.message_preview ?? null,
      data.status ?? 'sent',
      data.failure_reason ?? null,
      data.attempt_number ?? 1,
    ],
  );
  return result.rows[0];
}

export interface LogFilters {
  automation_type?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  customer_id?: string;
  page?: number;
  limit?: number;
}

export async function findLogs(
  tenantId: string,
  filters: LogFilters,
): Promise<{ data: AutomationLogEntry[]; total: number; page: number; limit: number }> {
  const conditions: string[] = ['tenant_id = $1'];
  const params: unknown[] = [tenantId];
  let paramIdx = 2;

  if (filters.automation_type) {
    conditions.push(`automation_type = $${paramIdx}`);
    params.push(filters.automation_type);
    paramIdx++;
  }
  if (filters.status) {
    conditions.push(`status = $${paramIdx}`);
    params.push(filters.status);
    paramIdx++;
  }
  if (filters.date_from) {
    conditions.push(`sent_at >= $${paramIdx}`);
    params.push(filters.date_from);
    paramIdx++;
  }
  if (filters.date_to) {
    conditions.push(`sent_at <= $${paramIdx}`);
    params.push(filters.date_to);
    paramIdx++;
  }
  if (filters.customer_id) {
    conditions.push(`customer_id = $${paramIdx}`);
    params.push(filters.customer_id);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const offset = (page - 1) * limit;

  const countResult = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM automation_log WHERE ${where}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await queryDb<AutomationLogEntry>(
    `SELECT * FROM automation_log
     WHERE ${where}
     ORDER BY sent_at DESC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset],
  );

  return { data: dataResult.rows, total, page, limit };
}

export async function hasBeenFiredRecently(
  tenantId: string,
  automationType: string,
  contextId: string,
  contextField: 'job_id' | 'quote_id' | 'invoice_id' = 'job_id',
): Promise<boolean> {
  const result = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM automation_log
     WHERE tenant_id = $1
       AND automation_type = $2
       AND ${contextField} = $3
       AND status IN ('sent', 'skipped')`,
    [tenantId, automationType, contextId],
  );
  return parseInt(result.rows[0].count, 10) > 0;
}

export async function countRecentFires(
  tenantId: string,
  automationType: string,
  contextId: string,
  contextField: 'job_id' | 'quote_id' | 'invoice_id' = 'invoice_id',
): Promise<number> {
  const result = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM automation_log
     WHERE tenant_id = $1
       AND automation_type = $2
       AND ${contextField} = $3
       AND status = 'sent'`,
    [tenantId, automationType, contextId],
  );
  return parseInt(result.rows[0].count, 10);
}
