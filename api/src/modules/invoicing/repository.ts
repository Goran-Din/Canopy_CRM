import { queryDb, getClient } from '../../config/database.js';
import type { InvoiceQuery, LineItemInput } from './schema.js';

// --- Types ---

export interface InvoiceRow {
  id: string;
  tenant_id: string;
  customer_id: string;
  property_id: string | null;
  contract_id: string | null;
  invoice_number: string;
  status: string;
  invoice_date: string;
  due_date: string;
  paid_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  currency: string;
  division: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  notes: string | null;
  internal_notes: string | null;
  xero_invoice_id: string | null;
  xero_sync_status: string;
  xero_last_synced_at: string | null;
  pdf_url: string | null;
  sent_at: string | null;
  sent_to_email: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  customer_display_name?: string;
  property_name?: string;
}

export interface InvoiceLineItemRow {
  id: string;
  tenant_id: string;
  invoice_id: string;
  job_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  tax_rate: number;
  tax_amount: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PaymentRow {
  id: string;
  tenant_id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  xero_payment_id: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface CountRow { count: string; }
interface SeqRow { next_num: string; }

const SORT_MAP: Record<string, string> = {
  invoice_number: 'i.invoice_number',
  invoice_date: 'i.invoice_date',
  due_date: 'i.due_date',
  total: 'i.total',
  status: 'i.status',
  created_at: 'i.created_at',
};

// ======== INVOICES ========

export async function findAllInvoices(
  tenantId: string,
  query: InvoiceQuery,
): Promise<{ rows: InvoiceRow[]; total: number }> {
  const conds: string[] = ['i.tenant_id = $1', 'i.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;

  if (query.search) {
    conds.push(`(i.invoice_number ILIKE $${pi} OR i.notes ILIKE $${pi})`);
    params.push(`%${query.search}%`);
    pi++;
  }
  if (query.status) { conds.push(`i.status = $${pi}`); params.push(query.status); pi++; }
  if (query.customer_id) { conds.push(`i.customer_id = $${pi}`); params.push(query.customer_id); pi++; }
  if (query.property_id) { conds.push(`i.property_id = $${pi}`); params.push(query.property_id); pi++; }
  if (query.contract_id) { conds.push(`i.contract_id = $${pi}`); params.push(query.contract_id); pi++; }
  if (query.division) { conds.push(`i.division = $${pi}`); params.push(query.division); pi++; }
  if (query.date_from) { conds.push(`i.invoice_date >= $${pi}`); params.push(query.date_from); pi++; }
  if (query.date_to) { conds.push(`i.invoice_date <= $${pi}`); params.push(query.date_to); pi++; }
  if (query.xero_sync_status) { conds.push(`i.xero_sync_status = $${pi}`); params.push(query.xero_sync_status); pi++; }

  const where = conds.join(' AND ');
  const sort = SORT_MAP[query.sortBy] || 'i.created_at';
  const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;

  const cnt = await queryDb<CountRow>(`SELECT COUNT(*) AS count FROM invoices i WHERE ${where}`, params);
  const total = parseInt(cnt.rows[0].count, 10);

  const data = await queryDb<InvoiceRow>(
    `SELECT i.*,
            c.display_name AS customer_display_name,
            p.property_name
     FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id AND c.deleted_at IS NULL
     LEFT JOIN properties p ON p.id = i.property_id AND p.deleted_at IS NULL
     WHERE ${where}
     ORDER BY ${sort} ${dir}
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );
  return { rows: data.rows, total };
}

export async function findInvoiceById(
  tenantId: string,
  id: string,
): Promise<(InvoiceRow & { line_items: InvoiceLineItemRow[]; payments: PaymentRow[] }) | null> {
  const res = await queryDb<InvoiceRow>(
    `SELECT i.*,
            c.display_name AS customer_display_name,
            p.property_name
     FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id AND c.deleted_at IS NULL
     LEFT JOIN properties p ON p.id = i.property_id AND p.deleted_at IS NULL
     WHERE i.id = $1 AND i.tenant_id = $2 AND i.deleted_at IS NULL`,
    [id, tenantId],
  );
  if (!res.rows[0]) return null;

  const lineItems = await getLineItems(tenantId, id);
  const payments = await getPayments(tenantId, id);

  return { ...res.rows[0], line_items: lineItems, payments };
}

export async function createInvoice(
  tenantId: string,
  data: Record<string, unknown>,
  lineItems: LineItemInput[],
  userId: string,
): Promise<InvoiceRow> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const invoiceRes = await client.query(
      `INSERT INTO invoices (
         tenant_id, customer_id, property_id, contract_id,
         invoice_number, status, invoice_date, due_date,
         subtotal, tax_rate, tax_amount, discount_amount, total,
         currency, division,
         billing_period_start, billing_period_end,
         notes, internal_notes,
         created_by, updated_by
       ) VALUES (
         $1, $2, $3, $4,
         $5, 'draft', $6, $7,
         $8, $9, $10, $11, $12,
         $13, $14,
         $15, $16,
         $17, $18,
         $19, $19
       ) RETURNING *`,
      [
        tenantId,
        data.customer_id,
        data.property_id || null,
        data.contract_id || null,
        data.invoice_number,
        data.invoice_date,
        data.due_date,
        data.subtotal,
        data.tax_rate ?? 0,
        data.tax_amount ?? 0,
        data.discount_amount ?? 0,
        data.total,
        data.currency || 'USD',
        data.division || null,
        data.billing_period_start || null,
        data.billing_period_end || null,
        data.notes || null,
        data.internal_notes || null,
        userId,
      ],
    );

    const invoice = invoiceRes.rows[0] as InvoiceRow;

    for (let i = 0; i < lineItems.length; i++) {
      const li = lineItems[i];
      const lineTotal = Number(li.quantity) * Number(li.unit_price);
      const lineTax = lineTotal * Number(li.tax_rate || 0);
      await client.query(
        `INSERT INTO invoice_line_items (
           tenant_id, invoice_id, job_id, description,
           quantity, unit_price, line_total, tax_rate, tax_amount, sort_order
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          tenantId,
          invoice.id,
          li.job_id || null,
          li.description,
          li.quantity,
          li.unit_price,
          lineTotal,
          li.tax_rate || 0,
          lineTax,
          li.sort_order ?? i,
        ],
      );
    }

    await client.query('COMMIT');
    return invoice;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateInvoice(
  tenantId: string,
  id: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<InvoiceRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let pi = 1;

  for (const [col, val] of Object.entries(data)) {
    if (val !== undefined && col !== 'updated_at') {
      sets.push(`${col} = $${pi}`);
      params.push(val ?? null);
      pi++;
    }
  }
  if (sets.length === 0) return findInvoiceByIdSimple(tenantId, id);

  sets.push(`updated_by = $${pi}`); params.push(userId); pi++;

  let cc = '';
  if (data.updated_at) { cc = ` AND updated_at = $${pi}`; params.push(data.updated_at); pi++; }

  params.push(id); params.push(tenantId);

  const res = await queryDb<InvoiceRow>(
    `UPDATE invoices SET ${sets.join(', ')}
     WHERE id = $${pi - 1} AND tenant_id = $${pi} AND deleted_at IS NULL${cc}
     RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

async function findInvoiceByIdSimple(tenantId: string, id: string): Promise<InvoiceRow | null> {
  const res = await queryDb<InvoiceRow>(
    `SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return res.rows[0] || null;
}

export async function updateStatus(
  tenantId: string,
  id: string,
  newStatus: string,
  userId: string,
  extraFields?: Record<string, unknown>,
): Promise<InvoiceRow | null> {
  const sets = ['status = $1', 'updated_by = $2'];
  const params: unknown[] = [newStatus, userId];
  let pi = 3;

  if (extraFields) {
    for (const [col, val] of Object.entries(extraFields)) {
      sets.push(`${col} = $${pi}`);
      params.push(val ?? null);
      pi++;
    }
  }

  params.push(id); params.push(tenantId);

  const res = await queryDb<InvoiceRow>(
    `UPDATE invoices SET ${sets.join(', ')}
     WHERE id = $${pi - 1} AND tenant_id = $${pi} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

export async function softDeleteInvoice(tenantId: string, id: string): Promise<InvoiceRow | null> {
  const res = await queryDb<InvoiceRow>(
    `UPDATE invoices SET deleted_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [id, tenantId],
  );
  return res.rows[0] || null;
}

export async function generateInvoiceNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const res = await queryDb<SeqRow>(
    `SELECT COUNT(*) + 1 AS next_num FROM invoices
     WHERE tenant_id = $1 AND invoice_number LIKE $2`,
    [tenantId, `INV-${year}-%`],
  );
  const nextNum = parseInt(res.rows[0].next_num, 10);
  return `INV-${year}-${String(nextNum).padStart(4, '0')}`;
}

// --- Line Items ---

export async function getLineItems(tenantId: string, invoiceId: string): Promise<InvoiceLineItemRow[]> {
  const res = await queryDb<InvoiceLineItemRow>(
    `SELECT * FROM invoice_line_items
     WHERE tenant_id = $1 AND invoice_id = $2 AND deleted_at IS NULL
     ORDER BY sort_order ASC, created_at ASC`,
    [tenantId, invoiceId],
  );
  return res.rows;
}

export async function addLineItem(
  tenantId: string,
  invoiceId: string,
  data: Record<string, unknown>,
): Promise<InvoiceLineItemRow> {
  const lineTotal = Number(data.quantity ?? 1) * Number(data.unit_price);
  const taxAmount = lineTotal * Number(data.tax_rate || 0);

  const res = await queryDb<InvoiceLineItemRow>(
    `INSERT INTO invoice_line_items (
       tenant_id, invoice_id, job_id, description,
       quantity, unit_price, line_total, tax_rate, tax_amount, sort_order
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      tenantId, invoiceId,
      data.job_id || null, data.description,
      data.quantity ?? 1, data.unit_price,
      lineTotal, data.tax_rate || 0, taxAmount,
      data.sort_order ?? 0,
    ],
  );
  return res.rows[0];
}

export async function updateLineItem(
  tenantId: string,
  lineItemId: string,
  data: Record<string, unknown>,
): Promise<InvoiceLineItemRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let pi = 1;

  const fields: Array<[string, unknown]> = [
    ['description', data.description],
    ['quantity', data.quantity],
    ['unit_price', data.unit_price],
    ['tax_rate', data.tax_rate],
    ['sort_order', data.sort_order],
  ];

  for (const [col, val] of fields) {
    if (val !== undefined) {
      sets.push(`${col} = $${pi}`);
      params.push(val ?? null);
      pi++;
    }
  }
  if (sets.length === 0) return null;

  // Recalculate line_total and tax_amount
  // We need current values for fields not being updated
  const existing = await getLineItemById(tenantId, lineItemId);
  if (!existing) return null;

  const qty = data.quantity !== undefined ? Number(data.quantity) : Number(existing.quantity);
  const price = data.unit_price !== undefined ? Number(data.unit_price) : Number(existing.unit_price);
  const taxRate = data.tax_rate !== undefined ? Number(data.tax_rate) : Number(existing.tax_rate);
  const lineTotal = qty * price;
  const taxAmount = lineTotal * taxRate;

  sets.push(`line_total = $${pi}`); params.push(lineTotal); pi++;
  sets.push(`tax_amount = $${pi}`); params.push(taxAmount); pi++;

  params.push(lineItemId); params.push(tenantId);

  const res = await queryDb<InvoiceLineItemRow>(
    `UPDATE invoice_line_items SET ${sets.join(', ')}
     WHERE id = $${pi - 1} AND tenant_id = $${pi} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

export async function removeLineItem(tenantId: string, lineItemId: string): Promise<InvoiceLineItemRow | null> {
  const res = await queryDb<InvoiceLineItemRow>(
    `UPDATE invoice_line_items SET deleted_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [lineItemId, tenantId],
  );
  return res.rows[0] || null;
}

export async function getLineItemById(tenantId: string, lineItemId: string): Promise<InvoiceLineItemRow | null> {
  const res = await queryDb<InvoiceLineItemRow>(
    `SELECT * FROM invoice_line_items WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [lineItemId, tenantId],
  );
  return res.rows[0] || null;
}

// --- Recalculate Totals ---

export async function recalculateTotals(tenantId: string, invoiceId: string): Promise<InvoiceRow | null> {
  const items = await getLineItems(tenantId, invoiceId);
  const subtotal = items.reduce((sum, li) => sum + Number(li.line_total), 0);
  const lineTaxTotal = items.reduce((sum, li) => sum + Number(li.tax_amount), 0);

  // Get current invoice for discount and invoice-level tax
  const invoice = await findInvoiceByIdSimple(tenantId, invoiceId);
  if (!invoice) return null;

  const invoiceTax = subtotal * Number(invoice.tax_rate);
  const taxAmount = lineTaxTotal + invoiceTax;
  const total = subtotal + taxAmount - Number(invoice.discount_amount);

  const res = await queryDb<InvoiceRow>(
    `UPDATE invoices SET subtotal = $1, tax_amount = $2, total = $3
     WHERE id = $4 AND tenant_id = $5 AND deleted_at IS NULL
     RETURNING *`,
    [subtotal, taxAmount, total, invoiceId, tenantId],
  );
  return res.rows[0] || null;
}

// --- Payments ---

export async function recordPayment(
  tenantId: string,
  invoiceId: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<PaymentRow> {
  const res = await queryDb<PaymentRow>(
    `INSERT INTO payments (
       tenant_id, invoice_id, payment_date, amount,
       payment_method, reference_number, notes, recorded_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      tenantId, invoiceId,
      data.payment_date, data.amount,
      data.payment_method,
      data.reference_number || null,
      data.notes || null,
      userId,
    ],
  );
  return res.rows[0];
}

export async function getPayments(tenantId: string, invoiceId: string): Promise<PaymentRow[]> {
  const res = await queryDb<PaymentRow>(
    `SELECT * FROM payments
     WHERE tenant_id = $1 AND invoice_id = $2 AND deleted_at IS NULL
     ORDER BY payment_date ASC, created_at ASC`,
    [tenantId, invoiceId],
  );
  return res.rows;
}

export async function updateAmountPaid(
  tenantId: string,
  invoiceId: string,
): Promise<InvoiceRow | null> {
  const res = await queryDb<InvoiceRow>(
    `UPDATE invoices SET amount_paid = (
       SELECT COALESCE(SUM(amount), 0) FROM payments
       WHERE tenant_id = $1 AND invoice_id = $2 AND deleted_at IS NULL
     )
     WHERE id = $2 AND tenant_id = $1 AND deleted_at IS NULL
     RETURNING *`,
    [tenantId, invoiceId],
  );
  return res.rows[0] || null;
}

// --- Generate helpers ---

export async function getContractWithLineItems(
  tenantId: string,
  contractId: string,
): Promise<{ contract: Record<string, unknown>; line_items: Array<Record<string, unknown>> } | null> {
  const contractRes = await queryDb<Record<string, unknown>>(
    `SELECT * FROM service_contracts WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [contractId, tenantId],
  );
  if (!contractRes.rows[0]) return null;

  const itemsRes = await queryDb<Record<string, unknown>>(
    `SELECT * FROM contract_line_items
     WHERE tenant_id = $1 AND contract_id = $2 AND deleted_at IS NULL
     ORDER BY sort_order ASC`,
    [tenantId, contractId],
  );

  return { contract: contractRes.rows[0], line_items: itemsRes.rows };
}

export async function getJobsForInvoice(
  tenantId: string,
  jobIds: string[],
): Promise<Array<Record<string, unknown>>> {
  if (jobIds.length === 0) return [];
  const placeholders = jobIds.map((_, i) => `$${i + 2}`).join(', ');
  const res = await queryDb<Record<string, unknown>>(
    `SELECT * FROM jobs
     WHERE tenant_id = $1 AND id IN (${placeholders}) AND deleted_at IS NULL`,
    [tenantId, ...jobIds],
  );
  return res.rows;
}

// --- Stats ---

export async function getStats(tenantId: string, divisionId?: string): Promise<{
  total_count: number;
  total_amount: string;
  paid_amount: string;
  outstanding_amount: string;
  overdue_count: number;
  overdue_amount: string;
  revenueByMonth: Array<{ month: string; total: string }>;
  revenueByDivision: Array<{ division: string; total: string }>;
}> {
  const params: (string)[] = [tenantId];
  const divisionFilter = divisionId ? ` AND division = $${params.push(divisionId)}` : '';

  const summaryRes = await queryDb<{
    total_count: string;
    total_amount: string;
    paid_amount: string;
    outstanding_amount: string;
    overdue_count: string;
    overdue_amount: string;
  }>(
    `SELECT
       COUNT(*)::text AS total_count,
       COALESCE(SUM(total), 0)::text AS total_amount,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE total - balance_due END), 0)::text AS paid_amount,
       COALESCE(SUM(CASE WHEN status IN ('sent', 'viewed', 'overdue', 'partially_paid') THEN balance_due ELSE 0 END), 0)::text AS outstanding_amount,
       COUNT(*) FILTER (WHERE status = 'overdue')::text AS overdue_count,
       COALESCE(SUM(CASE WHEN status = 'overdue' THEN balance_due ELSE 0 END), 0)::text AS overdue_amount
     FROM invoices
     WHERE tenant_id = $1 AND deleted_at IS NULL${divisionFilter}`,
    params,
  );

  const monthParams: (string)[] = [tenantId];
  const monthDivisionFilter = divisionId ? ` AND division = $${monthParams.push(divisionId)}` : '';

  const monthRes = await queryDb<{ month: string; total: string }>(
    `SELECT TO_CHAR(invoice_date, 'YYYY-MM') AS month,
            COALESCE(SUM(total), 0)::text AS total
     FROM invoices
     WHERE tenant_id = $1 AND status IN ('paid', 'partially_paid') AND deleted_at IS NULL${monthDivisionFilter}
     GROUP BY TO_CHAR(invoice_date, 'YYYY-MM')
     ORDER BY month DESC
     LIMIT 12`,
    monthParams,
  );

  const divisionRes = await queryDb<{ division: string; total: string }>(
    `SELECT division, COALESCE(SUM(total), 0)::text AS total
     FROM invoices
     WHERE tenant_id = $1 AND division IS NOT NULL AND deleted_at IS NULL
     GROUP BY division
     ORDER BY division`,
    [tenantId],
  );

  const summary = summaryRes.rows[0];
  return {
    total_count: parseInt(summary.total_count, 10),
    total_amount: summary.total_amount,
    paid_amount: summary.paid_amount,
    outstanding_amount: summary.outstanding_amount,
    overdue_count: parseInt(summary.overdue_count, 10),
    overdue_amount: summary.overdue_amount,
    revenueByMonth: monthRes.rows,
    revenueByDivision: divisionRes.rows,
  };
}

export async function getAgingReport(tenantId: string): Promise<{
  current: string;
  days_30: string;
  days_60: string;
  days_90_plus: string;
}> {
  const res = await queryDb<{ bucket: string; total: string }>(
    `SELECT
       CASE
         WHEN due_date >= CURRENT_DATE THEN 'current'
         WHEN due_date >= CURRENT_DATE - INTERVAL '30 days' THEN 'days_30'
         WHEN due_date >= CURRENT_DATE - INTERVAL '60 days' THEN 'days_60'
         ELSE 'days_90_plus'
       END AS bucket,
       COALESCE(SUM(balance_due), 0)::text AS total
     FROM invoices
     WHERE tenant_id = $1
       AND status IN ('sent', 'viewed', 'overdue', 'partially_paid')
       AND deleted_at IS NULL
     GROUP BY bucket`,
    [tenantId],
  );

  const buckets: Record<string, string> = { current: '0', days_30: '0', days_60: '0', days_90_plus: '0' };
  for (const row of res.rows) {
    buckets[row.bucket] = row.total;
  }
  return buckets as { current: string; days_30: string; days_60: string; days_90_plus: string };
}

// --- Validation helpers ---

export async function customerExists(tenantId: string, customerId: string): Promise<boolean> {
  const res = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM customers WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [customerId, tenantId],
  );
  return parseInt(res.rows[0].count, 10) > 0;
}
