import type pg from 'pg';
import { queryDb, getClient } from '../../config/database.js';
import type { OccurrenceQuery } from './schema.js';

export interface ServiceOccurrence {
  id: string;
  tenant_id: string;
  contract_id: string;
  property_id: string;
  customer_id: string;
  service_code: string;
  service_name: string;
  occurrence_number: number;
  season_year: number;
  status: string;
  assigned_date: string | null;
  preferred_month: string | null;
  job_id: string | null;
  skipped_reason: string | null;
  skipped_date: string | null;
  recovery_date: string | null;
  is_included_in_invoice: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ServiceListSummary {
  service_code: string;
  service_name: string;
  total_properties: string;
  occurrence_number: number;
  pending: string;
  assigned: string;
  completed: string;
  skipped: string;
}

export interface ServiceDetailRow extends ServiceOccurrence {
  display_name: string;
  customer_number: string | null;
  street_address: string | null;
  property_category: string | null;
  job_number: string | null;
}

export interface SeasonSummary {
  total: number;
  pending: number;
  assigned: number;
  completed: number;
  skipped: number;
}

export interface OccurrenceInsert {
  tenant_id: string;
  contract_id: string;
  property_id: string;
  customer_id: string;
  service_code: string;
  service_name: string;
  occurrence_number: number;
  season_year: number;
  status: string;
  preferred_month?: string | null;
  is_included_in_invoice: boolean;
  notes?: string | null;
}

interface CountRow {
  count: string;
}

interface SummaryRow {
  total: string;
  pending: string;
  assigned: string;
  completed: string;
  skipped: string;
}

/**
 * Bulk insert occurrences (idempotent — ON CONFLICT DO NOTHING).
 */
export async function bulkInsert(
  client: pg.PoolClient,
  occurrences: OccurrenceInsert[],
): Promise<number> {
  if (occurrences.length === 0) return 0;

  const values: unknown[] = [];
  const placeholders: string[] = [];
  let paramIdx = 1;

  for (const occ of occurrences) {
    placeholders.push(
      `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, $${paramIdx + 7}, $${paramIdx + 8}, $${paramIdx + 9}, $${paramIdx + 10}, $${paramIdx + 11})`,
    );
    values.push(
      occ.tenant_id, occ.contract_id, occ.property_id, occ.customer_id,
      occ.service_code, occ.service_name, occ.occurrence_number, occ.season_year,
      occ.status, occ.preferred_month ?? null, occ.is_included_in_invoice, occ.notes ?? null,
    );
    paramIdx += 12;
  }

  const result = await client.query(
    `INSERT INTO service_occurrences
     (tenant_id, contract_id, property_id, customer_id,
      service_code, service_name, occurrence_number, season_year,
      status, preferred_month, is_included_in_invoice, notes)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (contract_id, service_code, occurrence_number, season_year) DO NOTHING
     RETURNING id`,
    values,
  );
  return result.rowCount ?? 0;
}

/**
 * Find occurrences with filters and pagination.
 */
export async function findAll(
  tenantId: string,
  query: OccurrenceQuery,
): Promise<{ rows: ServiceOccurrence[]; total: number }> {
  const conditions: string[] = ['so.tenant_id = $1'];
  const params: unknown[] = [tenantId];
  let paramIdx = 2;

  if (query.season_year) {
    conditions.push(`so.season_year = $${paramIdx}`);
    params.push(query.season_year);
    paramIdx++;
  }
  if (query.service_code) {
    conditions.push(`so.service_code = $${paramIdx}`);
    params.push(query.service_code);
    paramIdx++;
  }
  if (query.status) {
    conditions.push(`so.status = $${paramIdx}`);
    params.push(query.status);
    paramIdx++;
  }
  if (query.contract_id) {
    conditions.push(`so.contract_id = $${paramIdx}`);
    params.push(query.contract_id);
    paramIdx++;
  }
  if (query.property_id) {
    conditions.push(`so.property_id = $${paramIdx}`);
    params.push(query.property_id);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const offset = (query.page - 1) * query.limit;

  const countResult = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM service_occurrences so WHERE ${where}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await queryDb<ServiceOccurrence>(
    `SELECT so.* FROM service_occurrences so
     WHERE ${where}
     ORDER BY so.service_code ASC, so.occurrence_number ASC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, query.limit, offset],
  );

  return { rows: dataResult.rows, total };
}

/**
 * Get single occurrence by ID.
 */
export async function getById(
  tenantId: string,
  id: string,
): Promise<ServiceOccurrence | null> {
  const result = await queryDb<ServiceOccurrence>(
    `SELECT * FROM service_occurrences WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}

/**
 * Update occurrence.
 */
export async function update(
  client: pg.PoolClient,
  id: string,
  tenantId: string,
  updates: Record<string, unknown>,
): Promise<ServiceOccurrence> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  const fields: Array<[string, unknown]> = [
    ['status', updates.status],
    ['assigned_date', updates.assigned_date],
    ['job_id', updates.job_id],
    ['skipped_reason', updates.skipped_reason],
    ['skipped_date', updates.skipped_date],
    ['recovery_date', updates.recovery_date],
    ['notes', updates.notes],
  ];

  for (const [col, val] of fields) {
    if (val !== undefined) {
      setClauses.push(`${col} = $${paramIdx}`);
      params.push(val ?? null);
      paramIdx++;
    }
  }

  if (setClauses.length === 0) {
    const result = await client.query<ServiceOccurrence>(
      `SELECT * FROM service_occurrences WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0];
  }

  params.push(id);
  params.push(tenantId);

  const result = await client.query<ServiceOccurrence>(
    `UPDATE service_occurrences SET ${setClauses.join(', ')}
     WHERE id = $${paramIdx - 1} AND tenant_id = $${paramIdx}
     RETURNING *`,
    params,
  );
  return result.rows[0];
}

/**
 * Count occurrences for a specific contract + service in a season.
 */
export async function countByContractService(
  tenantId: string,
  contractId: string,
  serviceCode: string,
  seasonYear: number,
): Promise<number> {
  const result = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM service_occurrences
     WHERE tenant_id = $1 AND contract_id = $2 AND service_code = $3 AND season_year = $4`,
    [tenantId, contractId, serviceCode, seasonYear],
  );
  return parseInt(result.rows[0].count, 10);
}

/**
 * Service List Summary — aggregate view for coordinator.
 */
export async function getServiceListSummary(
  tenantId: string,
  seasonYear: number,
): Promise<ServiceListSummary[]> {
  const result = await queryDb<ServiceListSummary>(
    `SELECT
       service_code,
       service_name,
       COUNT(DISTINCT property_id)::text AS total_properties,
       occurrence_number,
       COUNT(*) FILTER (WHERE status = 'pending')::text AS pending,
       COUNT(*) FILTER (WHERE status = 'assigned')::text AS assigned,
       COUNT(*) FILTER (WHERE status = 'completed')::text AS completed,
       COUNT(*) FILTER (WHERE status = 'skipped')::text AS skipped
     FROM service_occurrences
     WHERE tenant_id = $1 AND season_year = $2
     GROUP BY service_code, service_name, occurrence_number
     ORDER BY service_code, occurrence_number`,
    [tenantId, seasonYear],
  );
  return result.rows;
}

/**
 * Service Detail — properties for specific service + round.
 */
export async function getServiceDetail(
  tenantId: string,
  serviceCode: string,
  occurrenceNumber: number,
  seasonYear: number,
): Promise<ServiceDetailRow[]> {
  const result = await queryDb<ServiceDetailRow>(
    `SELECT so.*,
            c.display_name,
            c.customer_number,
            p.street_address,
            p.property_category,
            j.job_number
     FROM service_occurrences so
     JOIN customers c ON so.customer_id = c.id
     JOIN properties p ON so.property_id = p.id
     LEFT JOIN jobs j ON so.job_id = j.id
     WHERE so.tenant_id = $1 AND so.service_code = $2
       AND so.occurrence_number = $3 AND so.season_year = $4
     ORDER BY c.display_name`,
    [tenantId, serviceCode, occurrenceNumber, seasonYear],
  );
  return result.rows;
}

/**
 * Season summary stats.
 */
export async function getSeasonSummary(
  tenantId: string,
  seasonYear: number,
): Promise<SeasonSummary> {
  const result = await queryDb<SummaryRow>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE status = 'pending')::text AS pending,
       COUNT(*) FILTER (WHERE status = 'assigned')::text AS assigned,
       COUNT(*) FILTER (WHERE status = 'completed')::text AS completed,
       COUNT(*) FILTER (WHERE status = 'skipped')::text AS skipped
     FROM service_occurrences
     WHERE tenant_id = $1 AND season_year = $2`,
    [tenantId, seasonYear],
  );
  const row = result.rows[0];
  return {
    total: parseInt(row.total, 10),
    pending: parseInt(row.pending, 10),
    assigned: parseInt(row.assigned, 10),
    completed: parseInt(row.completed, 10),
    skipped: parseInt(row.skipped, 10),
  };
}

/**
 * Find occurrences for billing period.
 */
export async function findForBillingPeriod(
  tenantId: string,
  contractId: string,
  serviceCode: string,
  startDate: string,
  endDate: string,
): Promise<ServiceOccurrence[]> {
  const result = await queryDb<ServiceOccurrence>(
    `SELECT * FROM service_occurrences
     WHERE tenant_id = $1 AND contract_id = $2 AND service_code = $3
       AND assigned_date >= $4 AND assigned_date <= $5
       AND status IN ('completed', 'assigned')
     ORDER BY occurrence_number ASC`,
    [tenantId, contractId, serviceCode, startDate, endDate],
  );
  return result.rows;
}

export async function acquireClient(): Promise<pg.PoolClient> {
  return getClient();
}
