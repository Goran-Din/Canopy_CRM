import { queryDb, getClient } from '../../config/database.js';
import type { ContractQuery, CreateLineItemInput } from './schema.js';

export interface ContractRow {
  id: string;
  tenant_id: string;
  customer_id: string;
  property_id: string;
  contract_type: string;
  status: string;
  division: string;
  contract_number: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  signed_date: string | null;
  signed_by: string | null;
  billing_frequency: string;
  contract_value: number | null;
  recurring_amount: number | null;
  auto_renew: boolean;
  renewal_increase_percent: number;
  notes: string | null;
  tags: string[];
  xero_repeating_invoice_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface ContractWithRelations extends ContractRow {
  customer_display_name: string | null;
  property_name: string | null;
}

export interface LineItemRow {
  id: string;
  tenant_id: string;
  contract_id: string;
  service_name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  frequency: string | null;
  division: string | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

interface CountRow {
  count: string;
}

interface StatRow {
  label: string;
  count: string;
}

interface ValueStatRow {
  label: string;
  total_value: string;
}

interface SeqRow {
  next_num: string;
}

const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  title: 'sc.title',
  contract_number: 'sc.contract_number',
  created_at: 'sc.created_at',
  updated_at: 'sc.updated_at',
  status: 'sc.status',
  start_date: 'sc.start_date',
  contract_value: 'sc.contract_value',
};

export async function findAll(
  tenantId: string,
  query: ContractQuery,
): Promise<{ rows: ContractRow[]; total: number }> {
  const conditions: string[] = ['sc.tenant_id = $1', 'sc.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let paramIdx = 2;

  if (query.search) {
    conditions.push(
      `(sc.title ILIKE $${paramIdx} OR sc.contract_number ILIKE $${paramIdx} OR sc.description ILIKE $${paramIdx})`,
    );
    params.push(`%${query.search}%`);
    paramIdx++;
  }

  if (query.status) {
    conditions.push(`sc.status = $${paramIdx}`);
    params.push(query.status);
    paramIdx++;
  }

  if (query.type) {
    conditions.push(`sc.contract_type = $${paramIdx}`);
    params.push(query.type);
    paramIdx++;
  }

  if (query.division) {
    conditions.push(`sc.division = $${paramIdx}`);
    params.push(query.division);
    paramIdx++;
  }

  if (query.customer_id) {
    conditions.push(`sc.customer_id = $${paramIdx}`);
    params.push(query.customer_id);
    paramIdx++;
  }

  if (query.property_id) {
    conditions.push(`sc.property_id = $${paramIdx}`);
    params.push(query.property_id);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const sortCol = ALLOWED_SORT_COLUMNS[query.sortBy] || 'sc.created_at';
  const sortDir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;

  const countResult = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM service_contracts sc WHERE ${where}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await queryDb<ContractRow>(
    `SELECT sc.* FROM service_contracts sc
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
): Promise<(ContractWithRelations & { line_items: LineItemRow[] }) | null> {
  const result = await queryDb<ContractWithRelations>(
    `SELECT sc.*,
            c.display_name AS customer_display_name,
            p.property_name AS property_name
     FROM service_contracts sc
     LEFT JOIN customers c ON c.id = sc.customer_id AND c.deleted_at IS NULL
     LEFT JOIN properties p ON p.id = sc.property_id AND p.deleted_at IS NULL
     WHERE sc.id = $1 AND sc.tenant_id = $2 AND sc.deleted_at IS NULL`,
    [id, tenantId],
  );

  if (!result.rows[0]) return null;

  const lineItems = await getLineItems(tenantId, id);

  return { ...result.rows[0], line_items: lineItems };
}

export async function create(
  tenantId: string,
  data: Record<string, unknown>,
  lineItems: CreateLineItemInput[],
  userId: string,
): Promise<ContractRow> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const contractResult = await client.query(
      `INSERT INTO service_contracts (
         tenant_id, customer_id, property_id,
         contract_type, status, division,
         contract_number, title, description,
         start_date, end_date, signed_date, signed_by,
         billing_frequency, contract_value, recurring_amount,
         auto_renew, renewal_increase_percent,
         notes, tags, xero_repeating_invoice_id,
         created_by, updated_by
       ) VALUES (
         $1, $2, $3,
         $4, $5, $6,
         $7, $8, $9,
         $10, $11, $12, $13,
         $14, $15, $16,
         $17, $18,
         $19, $20, $21,
         $22, $22
       )
       RETURNING *`,
      [
        tenantId,
        data.customer_id,
        data.property_id,
        data.contract_type,
        data.status || 'draft',
        data.division,
        data.contract_number,
        data.title,
        data.description || null,
        data.start_date,
        data.end_date || null,
        data.signed_date || null,
        data.signed_by || null,
        data.billing_frequency,
        data.contract_value ?? null,
        data.recurring_amount ?? null,
        data.auto_renew ?? false,
        data.renewal_increase_percent ?? 0,
        data.notes || null,
        data.tags || [],
        data.xero_repeating_invoice_id || null,
        userId,
      ],
    );

    const contract = contractResult.rows[0] as ContractRow;

    // Insert line items
    for (let i = 0; i < lineItems.length; i++) {
      const li = lineItems[i];
      await client.query(
        `INSERT INTO contract_line_items (
           tenant_id, contract_id, service_name, description,
           quantity, unit_price, frequency, division, sort_order
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          tenantId,
          contract.id,
          li.service_name,
          li.description || null,
          li.quantity,
          li.unit_price,
          li.frequency || null,
          li.division || null,
          li.sort_order ?? i,
        ],
      );
    }

    await client.query('COMMIT');
    return contract;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function update(
  tenantId: string,
  id: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<ContractRow | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  const fields: Array<[string, unknown]> = [
    ['customer_id', data.customer_id],
    ['property_id', data.property_id],
    ['contract_type', data.contract_type],
    ['division', data.division],
    ['title', data.title],
    ['description', data.description],
    ['start_date', data.start_date],
    ['end_date', data.end_date],
    ['signed_date', data.signed_date],
    ['signed_by', data.signed_by],
    ['billing_frequency', data.billing_frequency],
    ['contract_value', data.contract_value],
    ['recurring_amount', data.recurring_amount],
    ['auto_renew', data.auto_renew],
    ['renewal_increase_percent', data.renewal_increase_percent],
    ['notes', data.notes],
    ['tags', data.tags],
    ['xero_repeating_invoice_id', data.xero_repeating_invoice_id],
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

  let concurrencyClause = '';
  if (data.updated_at) {
    concurrencyClause = ` AND sc.updated_at = $${paramIdx}`;
    params.push(data.updated_at);
    paramIdx++;
  }

  params.push(id);
  params.push(tenantId);

  const result = await queryDb<ContractRow>(
    `UPDATE service_contracts sc SET ${setClauses.join(', ')}
     WHERE sc.id = $${paramIdx - 1} AND sc.tenant_id = $${paramIdx} AND sc.deleted_at IS NULL${concurrencyClause}
     RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

async function findByIdSimple(tenantId: string, id: string): Promise<ContractRow | null> {
  const result = await queryDb<ContractRow>(
    `SELECT * FROM service_contracts WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}

export async function updateStatus(
  tenantId: string,
  id: string,
  newStatus: string,
  userId: string,
): Promise<ContractRow | null> {
  const result = await queryDb<ContractRow>(
    `UPDATE service_contracts SET status = $1, updated_by = $2
     WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL
     RETURNING *`,
    [newStatus, userId, id, tenantId],
  );
  return result.rows[0] || null;
}

export async function softDelete(
  tenantId: string,
  id: string,
): Promise<ContractRow | null> {
  const result = await queryDb<ContractRow>(
    `UPDATE service_contracts SET deleted_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [id, tenantId],
  );
  return result.rows[0] || null;
}

// --- Line Items ---

export async function getLineItems(
  tenantId: string,
  contractId: string,
): Promise<LineItemRow[]> {
  const result = await queryDb<LineItemRow>(
    `SELECT * FROM contract_line_items
     WHERE tenant_id = $1 AND contract_id = $2 AND deleted_at IS NULL
     ORDER BY sort_order ASC, created_at ASC`,
    [tenantId, contractId],
  );
  return result.rows;
}

export async function addLineItem(
  tenantId: string,
  contractId: string,
  data: Record<string, unknown>,
): Promise<LineItemRow> {
  const result = await queryDb<LineItemRow>(
    `INSERT INTO contract_line_items (
       tenant_id, contract_id, service_name, description,
       quantity, unit_price, frequency, division, sort_order
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      tenantId,
      contractId,
      data.service_name,
      data.description || null,
      data.quantity ?? 1,
      data.unit_price,
      data.frequency || null,
      data.division || null,
      data.sort_order ?? 0,
    ],
  );
  return result.rows[0];
}

export async function updateLineItem(
  tenantId: string,
  lineItemId: string,
  data: Record<string, unknown>,
): Promise<LineItemRow | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  const fields: Array<[string, unknown]> = [
    ['service_name', data.service_name],
    ['description', data.description],
    ['quantity', data.quantity],
    ['unit_price', data.unit_price],
    ['frequency', data.frequency],
    ['division', data.division],
    ['sort_order', data.sort_order],
  ];

  for (const [col, val] of fields) {
    if (val !== undefined) {
      setClauses.push(`${col} = $${paramIdx}`);
      params.push(val ?? null);
      paramIdx++;
    }
  }

  if (setClauses.length === 0) return null;

  params.push(lineItemId);
  params.push(tenantId);

  const result = await queryDb<LineItemRow>(
    `UPDATE contract_line_items SET ${setClauses.join(', ')}
     WHERE id = $${paramIdx - 1} AND tenant_id = $${paramIdx} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );
  return result.rows[0] || null;
}

export async function removeLineItem(
  tenantId: string,
  lineItemId: string,
): Promise<LineItemRow | null> {
  const result = await queryDb<LineItemRow>(
    `UPDATE contract_line_items SET deleted_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [lineItemId, tenantId],
  );
  return result.rows[0] || null;
}

export async function getLineItemById(
  tenantId: string,
  lineItemId: string,
): Promise<LineItemRow | null> {
  const result = await queryDb<LineItemRow>(
    `SELECT * FROM contract_line_items
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [lineItemId, tenantId],
  );
  return result.rows[0] || null;
}

// --- Contract Number Generation ---

export async function generateContractNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const result = await queryDb<SeqRow>(
    `SELECT COUNT(*) + 1 AS next_num FROM service_contracts
     WHERE tenant_id = $1 AND contract_number LIKE $2`,
    [tenantId, `SC-${year}-%`],
  );
  const nextNum = parseInt(result.rows[0].next_num, 10);
  return `SC-${year}-${String(nextNum).padStart(4, '0')}`;
}

// --- Stats ---

export async function getStats(
  tenantId: string,
): Promise<{ byStatus: StatRow[]; totalValueByType: ValueStatRow[] }> {
  const statusResult = await queryDb<StatRow>(
    `SELECT status AS label, COUNT(*)::text AS count
     FROM service_contracts
     WHERE tenant_id = $1 AND deleted_at IS NULL
     GROUP BY status
     ORDER BY status`,
    [tenantId],
  );

  const valueResult = await queryDb<ValueStatRow>(
    `SELECT contract_type AS label, COALESCE(SUM(contract_value), 0)::text AS total_value
     FROM service_contracts
     WHERE tenant_id = $1 AND deleted_at IS NULL
     GROUP BY contract_type
     ORDER BY contract_type`,
    [tenantId],
  );

  return { byStatus: statusResult.rows, totalValueByType: valueResult.rows };
}

// --- Validation helpers ---

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

export async function logPriceChange(
  tenantId: string,
  contractId: string,
  oldValue: number | null,
  newValue: number | null,
  changeReason: string | null,
  userId: string,
): Promise<void> {
  await queryDb(
    `INSERT INTO contract_price_history (
       tenant_id, contract_id, old_value, new_value, change_reason, changed_by
     ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [tenantId, contractId, oldValue, newValue, changeReason, userId],
  );
}
