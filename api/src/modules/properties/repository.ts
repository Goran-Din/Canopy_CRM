import { queryDb } from '../../config/database.js';
import type { PropertyQuery } from './schema.js';

export interface PropertyRow {
  id: string;
  tenant_id: string;
  customer_id: string;
  property_name: string | null;
  property_type: string;
  status: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
  lot_size_sqft: number | null;
  lawn_area_sqft: number | null;
  zone: string | null;
  service_frequency: string;
  property_photos_url: string[] | null;
  notes: string | null;
  tags: string[];
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface PropertyWithCustomer extends PropertyRow {
  customer_display_name: string | null;
}

interface CountRow {
  count: string;
}

export interface StatRow {
  label: string;
  count: string;
}

const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  property_name: 'p.property_name',
  created_at: 'p.created_at',
  updated_at: 'p.updated_at',
  status: 'p.status',
  city: 'p.city',
  zone: 'p.zone',
};

export async function findAll(
  tenantId: string,
  query: PropertyQuery,
): Promise<{ rows: PropertyRow[]; total: number }> {
  const conditions: string[] = ['p.tenant_id = $1', 'p.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let paramIdx = 2;

  if (query.search) {
    conditions.push(
      `(p.property_name ILIKE $${paramIdx} OR p.address_line1 ILIKE $${paramIdx} OR p.city ILIKE $${paramIdx} OR p.zone ILIKE $${paramIdx})`,
    );
    params.push(`%${query.search}%`);
    paramIdx++;
  }

  if (query.status) {
    conditions.push(`p.status = $${paramIdx}`);
    params.push(query.status);
    paramIdx++;
  }

  if (query.type) {
    conditions.push(`p.property_type = $${paramIdx}`);
    params.push(query.type);
    paramIdx++;
  }

  if (query.zone) {
    conditions.push(`p.zone = $${paramIdx}`);
    params.push(query.zone);
    paramIdx++;
  }

  if (query.customer_id) {
    conditions.push(`p.customer_id = $${paramIdx}`);
    params.push(query.customer_id);
    paramIdx++;
  }

  if (query.tag) {
    conditions.push(`$${paramIdx} = ANY(p.tags)`);
    params.push(query.tag);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const sortCol = ALLOWED_SORT_COLUMNS[query.sortBy] || 'p.created_at';
  const sortDir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;

  const countResult = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM properties p WHERE ${where}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await queryDb<PropertyRow>(
    `SELECT p.* FROM properties p
     WHERE ${where}
     ORDER BY ${sortCol} ${sortDir}
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, query.limit, offset],
  );

  return { rows: dataResult.rows, total };
}

export async function findById(
  tenantId: string,
  id: string,
): Promise<PropertyWithCustomer | null> {
  const result = await queryDb<PropertyWithCustomer>(
    `SELECT p.*, c.display_name AS customer_display_name
     FROM properties p
     LEFT JOIN customers c ON c.id = p.customer_id AND c.deleted_at IS NULL
     WHERE p.id = $1 AND p.tenant_id = $2 AND p.deleted_at IS NULL`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}

export async function findByCustomerId(
  tenantId: string,
  customerId: string,
): Promise<PropertyRow[]> {
  const result = await queryDb<PropertyRow>(
    `SELECT * FROM properties
     WHERE tenant_id = $1 AND customer_id = $2 AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [tenantId, customerId],
  );
  return result.rows;
}

export async function create(
  tenantId: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<PropertyRow> {
  const result = await queryDb<PropertyRow>(
    `INSERT INTO properties (
       tenant_id, customer_id, property_name, property_type, status,
       address_line1, address_line2, city, state, zip, country,
       latitude, longitude, google_maps_url,
       lot_size_sqft, lawn_area_sqft, zone, service_frequency,
       property_photos_url, notes, tags,
       created_by, updated_by
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9, $10, $11,
       $12, $13, $14,
       $15, $16, $17, $18,
       $19, $20, $21,
       $22, $22
     )
     RETURNING *`,
    [
      tenantId,
      data.customer_id,
      data.property_name || null,
      data.property_type,
      data.status,
      data.address_line1 || null,
      data.address_line2 || null,
      data.city || null,
      data.state || null,
      data.zip || null,
      data.country,
      data.latitude ?? null,
      data.longitude ?? null,
      data.google_maps_url || null,
      data.lot_size_sqft ?? null,
      data.lawn_area_sqft ?? null,
      data.zone || null,
      data.service_frequency,
      data.property_photos_url || null,
      data.notes || null,
      data.tags || [],
      userId,
    ],
  );
  return result.rows[0];
}

export async function update(
  tenantId: string,
  id: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<PropertyRow | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  const fields: Array<[string, unknown]> = [
    ['customer_id', data.customer_id],
    ['property_name', data.property_name],
    ['property_type', data.property_type],
    ['status', data.status],
    ['address_line1', data.address_line1],
    ['address_line2', data.address_line2],
    ['city', data.city],
    ['state', data.state],
    ['zip', data.zip],
    ['country', data.country],
    ['latitude', data.latitude],
    ['longitude', data.longitude],
    ['google_maps_url', data.google_maps_url],
    ['lot_size_sqft', data.lot_size_sqft],
    ['lawn_area_sqft', data.lawn_area_sqft],
    ['zone', data.zone],
    ['service_frequency', data.service_frequency],
    ['property_photos_url', data.property_photos_url],
    ['notes', data.notes],
    ['tags', data.tags],
  ];

  for (const [col, val] of fields) {
    if (val !== undefined) {
      setClauses.push(`${col} = $${paramIdx}`);
      params.push(val ?? null);
      paramIdx++;
    }
  }

  if (setClauses.length === 0) return findByIdSimple(tenantId, id);

  setClauses.push(`updated_by = $${paramIdx}`);
  params.push(userId);
  paramIdx++;

  // Optimistic concurrency: only update if updated_at matches
  let concurrencyClause = '';
  if (data.updated_at) {
    concurrencyClause = ` AND p.updated_at = $${paramIdx}`;
    params.push(data.updated_at);
    paramIdx++;
  }

  params.push(id);
  params.push(tenantId);

  const result = await queryDb<PropertyRow>(
    `UPDATE properties p SET ${setClauses.join(', ')}
     WHERE p.id = $${paramIdx - 1} AND p.tenant_id = $${paramIdx} AND p.deleted_at IS NULL${concurrencyClause}
     RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

async function findByIdSimple(tenantId: string, id: string): Promise<PropertyRow | null> {
  const result = await queryDb<PropertyRow>(
    `SELECT * FROM properties WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}

export async function softDelete(
  tenantId: string,
  id: string,
): Promise<PropertyRow | null> {
  const result = await queryDb<PropertyRow>(
    `UPDATE properties SET deleted_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}

export async function getStats(
  tenantId: string,
): Promise<{ byStatus: StatRow[]; byType: StatRow[]; byZone: StatRow[] }> {
  const statusResult = await queryDb<StatRow>(
    `SELECT status AS label, COUNT(*)::text AS count
     FROM properties
     WHERE tenant_id = $1 AND deleted_at IS NULL
     GROUP BY status
     ORDER BY status`,
    [tenantId],
  );

  const typeResult = await queryDb<StatRow>(
    `SELECT property_type AS label, COUNT(*)::text AS count
     FROM properties
     WHERE tenant_id = $1 AND deleted_at IS NULL
     GROUP BY property_type
     ORDER BY property_type`,
    [tenantId],
  );

  const zoneResult = await queryDb<StatRow>(
    `SELECT COALESCE(zone, 'unassigned') AS label, COUNT(*)::text AS count
     FROM properties
     WHERE tenant_id = $1 AND deleted_at IS NULL
     GROUP BY zone
     ORDER BY zone`,
    [tenantId],
  );

  return { byStatus: statusResult.rows, byType: typeResult.rows, byZone: zoneResult.rows };
}

export async function hasActiveContracts(
  tenantId: string,
  propertyId: string,
): Promise<boolean> {
  // Future-proof: check for contracts table existence
  try {
    const result = await queryDb<CountRow>(
      `SELECT COUNT(*) AS count FROM contracts
       WHERE tenant_id = $1 AND property_id = $2
         AND status = 'active' AND deleted_at IS NULL`,
      [tenantId, propertyId],
    );
    return parseInt(result.rows[0].count, 10) > 0;
  } catch {
    // contracts table doesn't exist yet — no active contracts
    return false;
  }
}

export async function customerExists(
  tenantId: string,
  customerId: string,
): Promise<boolean> {
  const result = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM customers
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [customerId, tenantId],
  );
  return parseInt(result.rows[0].count, 10) > 0;
}

// --- V2 Functions ---

/**
 * Update property V2 profile fields.
 */
export async function updateProfile(
  tenantId: string,
  propertyId: string,
  updates: Record<string, unknown>,
): Promise<PropertyRow | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  const v2Fields = [
    'property_category', 'property_description',
    'bed_area_sqft', 'num_bushes_shrubs', 'num_trees',
    'driveway_sqft', 'driveway_material', 'walkway_linear_ft', 'patio_sqft', 'parking_lot_sqft',
    'snow_service_active', 'snow_plow_area_sqft', 'snow_salting_area_sqft', 'snow_hand_shoveling_sqft',
    'entry_method', 'crew_parking', 'equipment_access', 'dogs_on_property', 'special_crew_instructions',
  ];

  for (const col of v2Fields) {
    if (updates[col] !== undefined) {
      setClauses.push(`${col} = $${paramIdx}`);
      params.push(updates[col] ?? null);
      paramIdx++;
    }
  }

  if (setClauses.length === 0) return findById(tenantId, propertyId);

  params.push(propertyId);
  params.push(tenantId);

  const result = await queryDb<PropertyRow>(
    `UPDATE properties SET ${setClauses.join(', ')}
     WHERE id = $${paramIdx - 1} AND tenant_id = $${paramIdx} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

export interface KnowledgeCardData extends PropertyWithCustomer {
  total_jobs: number;
  contracts: unknown;
}

/**
 * Get full knowledge card data.
 */
export async function getKnowledgeCard(
  tenantId: string,
  propertyId: string,
): Promise<KnowledgeCardData | null> {
  const result = await queryDb<KnowledgeCardData>(
    `SELECT p.*,
            c.display_name AS customer_display_name,
            (SELECT COUNT(*)::int FROM jobs WHERE property_id = p.id AND deleted_at IS NULL) AS total_jobs,
            (SELECT COALESCE(json_agg(json_build_object(
              'id', sc.id, 'title', sc.title, 'status', sc.status, 'service_tier', sc.service_tier
            )), '[]'::json) FROM service_contracts sc
            WHERE sc.property_id = p.id AND sc.deleted_at IS NULL AND sc.status = 'active') AS contracts
     FROM properties p
     LEFT JOIN customers c ON p.customer_id = c.id AND c.deleted_at IS NULL
     WHERE p.id = $1 AND p.tenant_id = $2 AND p.deleted_at IS NULL`,
    [propertyId, tenantId],
  );
  return result.rows[0] || null;
}

/**
 * Category summary (count by category).
 */
export async function getCategorySummary(tenantId: string): Promise<StatRow[]> {
  const result = await queryDb<StatRow>(
    `SELECT property_category AS label, COUNT(*)::text AS count
     FROM properties
     WHERE tenant_id = $1 AND deleted_at IS NULL AND property_category IS NOT NULL
     GROUP BY property_category
     ORDER BY property_category`,
    [tenantId],
  );
  return result.rows;
}

export interface CrewNote {
  id: string;
  tenant_id: string;
  property_id: string;
  note: string;
  created_by_user_id: string;
  created_at: Date;
}

/**
 * Insert crew field note (append-only).
 */
export async function insertCrewNote(
  tenantId: string,
  propertyId: string,
  note: string,
  userId: string,
): Promise<CrewNote> {
  // Store in job_diary_entries with entry_type = 'crew_field_note'
  // Using property_service_history notes column is alternative, but diary is append-only
  const result = await queryDb<CrewNote>(
    `INSERT INTO job_diary_entries
     (tenant_id, job_id, entry_type, title, body, metadata, created_by_user_id, is_system_entry)
     SELECT $1, j.id, 'note_added', $3, $4,
       json_build_object('property_id', $2, 'type', 'crew_field_note'),
       $5, false
     FROM jobs j
     WHERE j.property_id = $2 AND j.tenant_id = $1 AND j.deleted_at IS NULL
     ORDER BY j.created_at DESC LIMIT 1
     RETURNING id, tenant_id, $2::uuid AS property_id, body AS note, created_by_user_id, created_at`,
    [tenantId, propertyId, `Crew note: ${note.substring(0, 50)}`, note, userId],
  );

  // If no job found, insert a standalone record in property_service_history notes
  if (!result.rows[0]) {
    const fallback = await queryDb<CrewNote>(
      `INSERT INTO property_service_history
       (tenant_id, property_id, customer_id, service_code, service_name,
        service_date, season_year, division, status, notes)
       SELECT $1, $2, p.customer_id, 'CREW-NOTE', 'Crew Field Note',
        CURRENT_DATE, EXTRACT(YEAR FROM CURRENT_DATE)::smallint, 'landscaping_maintenance', 'completed', $3
       FROM properties p WHERE p.id = $2 AND p.tenant_id = $1
       RETURNING id, tenant_id, property_id, notes AS note, NULL::uuid AS created_by_user_id, created_at`,
      [tenantId, propertyId, note],
    );
    return fallback.rows[0];
  }

  return result.rows[0];
}

/**
 * Get crew notes for a property (newest first).
 */
export async function findCrewNotes(
  tenantId: string,
  propertyId: string,
): Promise<CrewNote[]> {
  const result = await queryDb<CrewNote>(
    `SELECT id, tenant_id, $2::uuid AS property_id, body AS note, created_by_user_id, created_at
     FROM job_diary_entries
     WHERE tenant_id = $1
       AND metadata->>'property_id' = $2
       AND metadata->>'type' = 'crew_field_note'
     ORDER BY created_at DESC`,
    [tenantId, propertyId],
  );
  return result.rows;
}

/**
 * Get job history for a property.
 */
export async function getJobHistory(
  tenantId: string,
  propertyId: string,
): Promise<unknown[]> {
  const result = await queryDb(
    `SELECT j.id, j.job_number, j.title, j.status, j.division,
            j.scheduled_date, j.actual_start_time, j.actual_end_time,
            j.assigned_crew_id, j.created_at
     FROM jobs j
     WHERE j.tenant_id = $1 AND j.property_id = $2 AND j.deleted_at IS NULL
     ORDER BY j.scheduled_date DESC NULLS LAST, j.created_at DESC
     LIMIT 50`,
    [tenantId, propertyId],
  );
  return result.rows;
}

/**
 * Get photos for a property (from job_photos V2 table).
 */
export async function getPropertyPhotos(
  tenantId: string,
  propertyId: string,
): Promise<unknown[]> {
  const result = await queryDb(
    `SELECT jp.id, jp.photo_tag, jp.caption, jp.portal_visible,
            jp.created_at, j.job_number, j.title AS job_title
     FROM job_photos jp
     JOIN jobs j ON jp.job_id = j.id
     WHERE jp.tenant_id = $1 AND jp.property_id = $2 AND jp.deleted_at IS NULL
     ORDER BY jp.created_at DESC
     LIMIT 100`,
    [tenantId, propertyId],
  );
  return result.rows;
}
