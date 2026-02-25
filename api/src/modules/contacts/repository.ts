import { queryDb, getClient } from '../../config/database.js';
import type { ContactQuery } from './schema.js';

export interface ContactRow {
  id: string;
  tenant_id: string;
  customer_id: string;
  property_id: string | null;
  contact_type: string;
  is_primary: boolean;
  preferred_contact_method: string;
  first_name: string;
  last_name: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  job_title: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ContactWithRelations extends ContactRow {
  customer_display_name: string | null;
  property_name: string | null;
}

interface CountRow {
  count: string;
}

const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  display_name: 'ct.display_name',
  created_at: 'ct.created_at',
  updated_at: 'ct.updated_at',
  contact_type: 'ct.contact_type',
  email: 'ct.email',
};

export async function findAll(
  tenantId: string,
  query: ContactQuery,
): Promise<{ rows: ContactRow[]; total: number }> {
  const conditions: string[] = ['ct.tenant_id = $1', 'ct.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let paramIdx = 2;

  if (query.search) {
    conditions.push(
      `(ct.display_name ILIKE $${paramIdx} OR ct.email ILIKE $${paramIdx} OR ct.phone ILIKE $${paramIdx} OR ct.mobile ILIKE $${paramIdx})`,
    );
    params.push(`%${query.search}%`);
    paramIdx++;
  }

  if (query.customer_id) {
    conditions.push(`ct.customer_id = $${paramIdx}`);
    params.push(query.customer_id);
    paramIdx++;
  }

  if (query.property_id) {
    conditions.push(`ct.property_id = $${paramIdx}`);
    params.push(query.property_id);
    paramIdx++;
  }

  if (query.type) {
    conditions.push(`ct.contact_type = $${paramIdx}`);
    params.push(query.type);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const sortCol = ALLOWED_SORT_COLUMNS[query.sortBy] || 'ct.created_at';
  const sortDir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;

  const countResult = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM contacts ct WHERE ${where}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await queryDb<ContactRow>(
    `SELECT ct.* FROM contacts ct
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
): Promise<ContactWithRelations | null> {
  const result = await queryDb<ContactWithRelations>(
    `SELECT ct.*,
            c.display_name AS customer_display_name,
            p.property_name AS property_name
     FROM contacts ct
     LEFT JOIN customers c ON c.id = ct.customer_id AND c.deleted_at IS NULL
     LEFT JOIN properties p ON p.id = ct.property_id AND p.deleted_at IS NULL
     WHERE ct.id = $1 AND ct.tenant_id = $2 AND ct.deleted_at IS NULL`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}

export async function findByCustomerId(
  tenantId: string,
  customerId: string,
): Promise<ContactRow[]> {
  const result = await queryDb<ContactRow>(
    `SELECT * FROM contacts
     WHERE tenant_id = $1 AND customer_id = $2 AND deleted_at IS NULL
     ORDER BY is_primary DESC, created_at ASC`,
    [tenantId, customerId],
  );
  return result.rows;
}

export async function findByPropertyId(
  tenantId: string,
  propertyId: string,
): Promise<ContactRow[]> {
  const result = await queryDb<ContactRow>(
    `SELECT * FROM contacts
     WHERE tenant_id = $1 AND property_id = $2 AND deleted_at IS NULL
     ORDER BY is_primary DESC, created_at ASC`,
    [tenantId, propertyId],
  );
  return result.rows;
}

export async function countByCustomerId(
  tenantId: string,
  customerId: string,
): Promise<number> {
  const result = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM contacts
     WHERE tenant_id = $1 AND customer_id = $2 AND deleted_at IS NULL`,
    [tenantId, customerId],
  );
  return parseInt(result.rows[0].count, 10);
}

export async function create(
  tenantId: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<ContactRow> {
  const result = await queryDb<ContactRow>(
    `INSERT INTO contacts (
       tenant_id, customer_id, property_id,
       contact_type, is_primary, preferred_contact_method,
       first_name, last_name, display_name,
       email, phone, mobile, job_title,
       notes,
       created_by, updated_by
     ) VALUES (
       $1, $2, $3,
       $4, $5, $6,
       $7, $8, $9,
       $10, $11, $12, $13,
       $14,
       $15, $15
     )
     RETURNING *`,
    [
      tenantId,
      data.customer_id,
      data.property_id || null,
      data.contact_type,
      data.is_primary,
      data.preferred_contact_method,
      data.first_name,
      data.last_name,
      data.display_name,
      data.email || null,
      data.phone || null,
      data.mobile || null,
      data.job_title || null,
      data.notes || null,
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
): Promise<ContactRow | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  const fields: Array<[string, unknown]> = [
    ['customer_id', data.customer_id],
    ['property_id', data.property_id],
    ['contact_type', data.contact_type],
    ['is_primary', data.is_primary],
    ['preferred_contact_method', data.preferred_contact_method],
    ['first_name', data.first_name],
    ['last_name', data.last_name],
    ['display_name', data.display_name],
    ['email', data.email],
    ['phone', data.phone],
    ['mobile', data.mobile],
    ['job_title', data.job_title],
    ['notes', data.notes],
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

  // Optimistic concurrency
  let concurrencyClause = '';
  if (data.updated_at) {
    concurrencyClause = ` AND ct.updated_at = $${paramIdx}`;
    params.push(data.updated_at);
    paramIdx++;
  }

  params.push(id);
  params.push(tenantId);

  const result = await queryDb<ContactRow>(
    `UPDATE contacts ct SET ${setClauses.join(', ')}
     WHERE ct.id = $${paramIdx - 1} AND ct.tenant_id = $${paramIdx} AND ct.deleted_at IS NULL${concurrencyClause}
     RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

async function findByIdSimple(tenantId: string, id: string): Promise<ContactRow | null> {
  const result = await queryDb<ContactRow>(
    `SELECT * FROM contacts WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}

export async function softDelete(
  tenantId: string,
  id: string,
): Promise<ContactRow | null> {
  const result = await queryDb<ContactRow>(
    `UPDATE contacts SET deleted_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}

export async function setPrimary(
  tenantId: string,
  customerId: string,
  contactId: string,
): Promise<ContactRow | null> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Unset existing primary for this customer
    await client.query(
      `UPDATE contacts SET is_primary = false
       WHERE tenant_id = $1 AND customer_id = $2 AND is_primary = true AND deleted_at IS NULL`,
      [tenantId, customerId],
    );

    // Set new primary
    const result = await client.query(
      `UPDATE contacts SET is_primary = true
       WHERE id = $1 AND tenant_id = $2 AND customer_id = $3 AND deleted_at IS NULL
       RETURNING *`,
      [contactId, tenantId, customerId],
    );

    await client.query('COMMIT');
    return result.rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
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

export async function propertyBelongsToCustomer(
  tenantId: string,
  propertyId: string,
  customerId: string,
): Promise<boolean> {
  const result = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM properties
     WHERE id = $1 AND tenant_id = $2 AND customer_id = $3 AND deleted_at IS NULL`,
    [propertyId, tenantId, customerId],
  );
  return parseInt(result.rows[0].count, 10) > 0;
}
