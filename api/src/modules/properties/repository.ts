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

interface PropertyWithCustomer extends PropertyRow {
  customer_display_name: string | null;
}

interface CountRow {
  count: string;
}

interface StatRow {
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
