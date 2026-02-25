import { queryDb } from '../../config/database.js';
import type { CustomerQuery } from './schema.js';

export interface CustomerRow {
  id: string;
  tenant_id: string;
  customer_type: string;
  status: string;
  source: string;
  company_name: string | null;
  first_name: string;
  last_name: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_zip: string | null;
  billing_country: string;
  notes: string | null;
  tags: string[];
  referred_by_customer_id: string | null;
  xero_contact_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CustomerWithCount extends CustomerRow {
  property_count: number;
}

interface CountRow {
  count: string;
}

export interface StatRow {
  label: string;
  count: string;
}

const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  display_name: 'c.display_name',
  created_at: 'c.created_at',
  updated_at: 'c.updated_at',
  status: 'c.status',
  email: 'c.email',
};

export async function findAll(
  tenantId: string,
  query: CustomerQuery,
): Promise<{ rows: CustomerRow[]; total: number }> {
  const conditions: string[] = ['c.tenant_id = $1', 'c.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let paramIdx = 2;

  if (query.search) {
    conditions.push(
      `(c.display_name ILIKE $${paramIdx} OR c.email ILIKE $${paramIdx} OR c.phone ILIKE $${paramIdx} OR c.mobile ILIKE $${paramIdx})`,
    );
    params.push(`%${query.search}%`);
    paramIdx++;
  }

  if (query.status) {
    conditions.push(`c.status = $${paramIdx}`);
    params.push(query.status);
    paramIdx++;
  }

  if (query.type) {
    conditions.push(`c.customer_type = $${paramIdx}`);
    params.push(query.type);
    paramIdx++;
  }

  if (query.tag) {
    conditions.push(`$${paramIdx} = ANY(c.tags)`);
    params.push(query.tag);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const sortCol = ALLOWED_SORT_COLUMNS[query.sortBy] || 'c.created_at';
  const sortDir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;

  const countResult = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM customers c WHERE ${where}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await queryDb<CustomerRow>(
    `SELECT c.* FROM customers c
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
): Promise<CustomerWithCount | null> {
  const result = await queryDb<CustomerWithCount>(
    `SELECT c.*, COALESCE(p.cnt, 0)::int AS property_count
     FROM customers c
     LEFT JOIN (
       SELECT customer_id, COUNT(*) AS cnt
       FROM properties
       WHERE deleted_at IS NULL
       GROUP BY customer_id
     ) p ON p.customer_id = c.id
     WHERE c.id = $1 AND c.tenant_id = $2 AND c.deleted_at IS NULL`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}

export async function create(
  tenantId: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<CustomerRow> {
  const result = await queryDb<CustomerRow>(
    `INSERT INTO customers (
       tenant_id, customer_type, status, source,
       company_name, first_name, last_name, display_name,
       email, phone, mobile,
       billing_address_line1, billing_address_line2,
       billing_city, billing_state, billing_zip, billing_country,
       notes, tags, referred_by_customer_id, xero_contact_id,
       created_by, updated_by
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, $8,
       $9, $10, $11,
       $12, $13,
       $14, $15, $16, $17,
       $18, $19, $20, $21,
       $22, $22
     )
     RETURNING *`,
    [
      tenantId,
      data.customer_type,
      data.status,
      data.source,
      data.company_name || null,
      data.first_name,
      data.last_name,
      data.display_name,
      data.email || null,
      data.phone || null,
      data.mobile || null,
      data.billing_address_line1 || null,
      data.billing_address_line2 || null,
      data.billing_city || null,
      data.billing_state || null,
      data.billing_zip || null,
      data.billing_country,
      data.notes || null,
      data.tags || [],
      data.referred_by_customer_id || null,
      data.xero_contact_id || null,
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
): Promise<CustomerRow | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  const fields: Array<[string, unknown]> = [
    ['customer_type', data.customer_type],
    ['status', data.status],
    ['source', data.source],
    ['company_name', data.company_name],
    ['first_name', data.first_name],
    ['last_name', data.last_name],
    ['display_name', data.display_name],
    ['email', data.email],
    ['phone', data.phone],
    ['mobile', data.mobile],
    ['billing_address_line1', data.billing_address_line1],
    ['billing_address_line2', data.billing_address_line2],
    ['billing_city', data.billing_city],
    ['billing_state', data.billing_state],
    ['billing_zip', data.billing_zip],
    ['billing_country', data.billing_country],
    ['notes', data.notes],
    ['tags', data.tags],
    ['referred_by_customer_id', data.referred_by_customer_id],
    ['xero_contact_id', data.xero_contact_id],
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
    concurrencyClause = ` AND c.updated_at = $${paramIdx}`;
    params.push(data.updated_at);
    paramIdx++;
  }

  params.push(id);
  params.push(tenantId);

  const result = await queryDb<CustomerRow>(
    `UPDATE customers c SET ${setClauses.join(', ')}
     WHERE c.id = $${paramIdx - 1} AND c.tenant_id = $${paramIdx} AND c.deleted_at IS NULL${concurrencyClause}
     RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

async function findByIdSimple(tenantId: string, id: string): Promise<CustomerRow | null> {
  const result = await queryDb<CustomerRow>(
    `SELECT * FROM customers WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}

export async function softDelete(
  tenantId: string,
  id: string,
): Promise<CustomerRow | null> {
  const result = await queryDb<CustomerRow>(
    `UPDATE customers SET deleted_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}

export async function findByEmail(
  tenantId: string,
  email: string,
  excludeId?: string,
): Promise<CustomerRow | null> {
  const params: unknown[] = [tenantId, email];
  let excludeClause = '';
  if (excludeId) {
    excludeClause = ' AND id != $3';
    params.push(excludeId);
  }
  const result = await queryDb<CustomerRow>(
    `SELECT * FROM customers
     WHERE tenant_id = $1 AND email = $2 AND deleted_at IS NULL${excludeClause}
     LIMIT 1`,
    params,
  );
  return result.rows[0] || null;
}

export async function getStats(
  tenantId: string,
): Promise<{ byStatus: StatRow[]; byType: StatRow[] }> {
  const statusResult = await queryDb<StatRow>(
    `SELECT status AS label, COUNT(*)::text AS count
     FROM customers
     WHERE tenant_id = $1 AND deleted_at IS NULL
     GROUP BY status
     ORDER BY status`,
    [tenantId],
  );

  const typeResult = await queryDb<StatRow>(
    `SELECT customer_type AS label, COUNT(*)::text AS count
     FROM customers
     WHERE tenant_id = $1 AND deleted_at IS NULL
     GROUP BY customer_type
     ORDER BY customer_type`,
    [tenantId],
  );

  return { byStatus: statusResult.rows, byType: typeResult.rows };
}

export async function hasActiveContracts(
  tenantId: string,
  customerId: string,
): Promise<boolean> {
  // Future-proof: check for contracts table existence
  try {
    const result = await queryDb<CountRow>(
      `SELECT COUNT(*) AS count FROM contracts
       WHERE tenant_id = $1 AND customer_id = $2
         AND status = 'active' AND deleted_at IS NULL`,
      [tenantId, customerId],
    );
    return parseInt(result.rows[0].count, 10) > 0;
  } catch {
    // contracts table doesn't exist yet — no active contracts
    return false;
  }
}
