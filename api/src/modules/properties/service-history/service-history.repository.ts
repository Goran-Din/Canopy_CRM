import type pg from 'pg';
import { queryDb } from '../../../config/database.js';

export interface ServiceHistoryEntry {
  id: string;
  tenant_id: string;
  property_id: string;
  customer_id: string;
  contract_id: string | null;
  job_id: string | null;
  service_code: string;
  service_name: string;
  service_date: string;
  season_year: number;
  division: string;
  crew_id: string | null;
  status: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ServiceHistoryUpsert {
  tenant_id: string;
  property_id: string;
  customer_id: string;
  contract_id?: string | null;
  job_id?: string | null;
  service_code: string;
  service_name: string;
  service_date: string;
  season_year: number;
  division: string;
  crew_id?: string | null;
  status?: string;
  notes?: string | null;
}

export interface PricingStats {
  count: string;
  price_range_min: string | null;
  price_range_max: string | null;
  price_median: string | null;
}

/**
 * Upsert service history entry (auto-populated by other modules).
 */
export async function upsert(
  client: pg.PoolClient,
  entry: ServiceHistoryUpsert,
): Promise<void> {
  await client.query(
    `INSERT INTO property_service_history
     (tenant_id, property_id, customer_id, contract_id, job_id,
      service_code, service_name, service_date, season_year, division, crew_id, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (property_id, service_code, season_year)
     DO UPDATE SET
       service_date = COALESCE(EXCLUDED.service_date, property_service_history.service_date),
       crew_id = COALESCE(EXCLUDED.crew_id, property_service_history.crew_id),
       job_id = COALESCE(EXCLUDED.job_id, property_service_history.job_id),
       status = COALESCE(EXCLUDED.status, property_service_history.status),
       notes = COALESCE(EXCLUDED.notes, property_service_history.notes),
       updated_at = NOW()`,
    [
      entry.tenant_id, entry.property_id, entry.customer_id,
      entry.contract_id ?? null, entry.job_id ?? null,
      entry.service_code, entry.service_name, entry.service_date,
      entry.season_year, entry.division, entry.crew_id ?? null,
      entry.status ?? 'completed', entry.notes ?? null,
    ],
  );
}

/**
 * Standalone upsert (no transaction client needed).
 */
export async function upsertStandalone(entry: ServiceHistoryUpsert): Promise<void> {
  await queryDb(
    `INSERT INTO property_service_history
     (tenant_id, property_id, customer_id, contract_id, job_id,
      service_code, service_name, service_date, season_year, division, crew_id, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (property_id, service_code, season_year)
     DO UPDATE SET
       service_date = COALESCE(EXCLUDED.service_date, property_service_history.service_date),
       crew_id = COALESCE(EXCLUDED.crew_id, property_service_history.crew_id),
       job_id = COALESCE(EXCLUDED.job_id, property_service_history.job_id),
       status = COALESCE(EXCLUDED.status, property_service_history.status),
       notes = COALESCE(EXCLUDED.notes, property_service_history.notes),
       updated_at = NOW()`,
    [
      entry.tenant_id, entry.property_id, entry.customer_id,
      entry.contract_id ?? null, entry.job_id ?? null,
      entry.service_code, entry.service_name, entry.service_date,
      entry.season_year, entry.division, entry.crew_id ?? null,
      entry.status ?? 'completed', entry.notes ?? null,
    ],
  );
}

/**
 * Get history for property (grouped by service, ordered by season year).
 */
export async function findByPropertyId(
  tenantId: string,
  propertyId: string,
): Promise<ServiceHistoryEntry[]> {
  const result = await queryDb<ServiceHistoryEntry>(
    `SELECT * FROM property_service_history
     WHERE tenant_id = $1 AND property_id = $2
     ORDER BY season_year DESC, service_code`,
    [tenantId, propertyId],
  );
  return result.rows;
}

/**
 * Get history for specific service across years (for estimation context).
 */
export async function findByPropertyService(
  tenantId: string,
  propertyId: string,
  serviceCode: string,
): Promise<ServiceHistoryEntry[]> {
  const result = await queryDb<ServiceHistoryEntry>(
    `SELECT * FROM property_service_history
     WHERE tenant_id = $1 AND property_id = $2 AND service_code = $3
     ORDER BY season_year DESC`,
    [tenantId, propertyId, serviceCode],
  );
  return result.rows;
}

/**
 * Get similar property pricing for estimation assistant.
 */
export async function getSimilarPropertyPricing(
  tenantId: string,
  propertyCategory: string,
  serviceCode: string,
  seasonYear: number,
): Promise<PricingStats> {
  const result = await queryDb<PricingStats>(
    `SELECT
       COUNT(*)::text AS count,
       MIN(psh.service_date)::text AS price_range_min,
       MAX(psh.service_date)::text AS price_range_max,
       NULL::text AS price_median
     FROM property_service_history psh
     JOIN properties p ON psh.property_id = p.id
     WHERE psh.tenant_id = $1
       AND p.property_category = $2
       AND psh.service_code = $3
       AND psh.season_year = $4`,
    [tenantId, propertyCategory, serviceCode, seasonYear],
  );
  return result.rows[0];
}
