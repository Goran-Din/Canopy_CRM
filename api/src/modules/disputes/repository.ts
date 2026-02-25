import { queryDb, getClient } from '../../config/database.js';
import type { DisputeQuery, CreditNoteQuery } from './schema.js';

// --- Types ---

export interface DisputeRow {
  id: string;
  tenant_id: string;
  invoice_id: string;
  customer_id: string;
  dispute_number: string;
  status: string;
  reason: string;
  description: string;
  disputed_amount: number;
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  assigned_to: string | null;
  priority: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  customer_display_name?: string;
  invoice_number?: string;
}

export interface CreditNoteRow {
  id: string;
  tenant_id: string;
  invoice_id: string;
  dispute_id: string | null;
  customer_id: string;
  credit_note_number: string;
  status: string;
  amount: number;
  reason: string;
  applied_at: string | null;
  applied_by: string | null;
  xero_credit_note_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  customer_display_name?: string;
  invoice_number?: string;
}

interface CountRow { count: string; }
interface SeqRow { next_num: string; }
interface InvoiceTotalRow { total: number; }

const DISPUTE_SORT_MAP: Record<string, string> = {
  dispute_number: 'd.dispute_number',
  status: 'd.status',
  priority: 'd.priority',
  disputed_amount: 'd.disputed_amount',
  created_at: 'd.created_at',
};

const CN_SORT_MAP: Record<string, string> = {
  credit_note_number: 'cn.credit_note_number',
  amount: 'cn.amount',
  status: 'cn.status',
  created_at: 'cn.created_at',
};

// ======== DISPUTES ========

export async function findAllDisputes(
  tenantId: string,
  query: DisputeQuery,
): Promise<{ rows: DisputeRow[]; total: number }> {
  const conds: string[] = ['d.tenant_id = $1', 'd.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;

  if (query.search) {
    conds.push(`(d.dispute_number ILIKE $${pi} OR d.description ILIKE $${pi})`);
    params.push(`%${query.search}%`);
    pi++;
  }
  if (query.status) { conds.push(`d.status = $${pi}`); params.push(query.status); pi++; }
  if (query.customer_id) { conds.push(`d.customer_id = $${pi}`); params.push(query.customer_id); pi++; }
  if (query.invoice_id) { conds.push(`d.invoice_id = $${pi}`); params.push(query.invoice_id); pi++; }
  if (query.priority) { conds.push(`d.priority = $${pi}`); params.push(query.priority); pi++; }
  if (query.assigned_to) { conds.push(`d.assigned_to = $${pi}`); params.push(query.assigned_to); pi++; }

  const where = conds.join(' AND ');
  const sort = DISPUTE_SORT_MAP[query.sortBy] || 'd.created_at';
  const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;

  const cnt = await queryDb<CountRow>(`SELECT COUNT(*) AS count FROM disputes d WHERE ${where}`, params);
  const total = parseInt(cnt.rows[0].count, 10);

  const data = await queryDb<DisputeRow>(
    `SELECT d.*,
            c.display_name AS customer_display_name,
            i.invoice_number
     FROM disputes d
     LEFT JOIN customers c ON c.id = d.customer_id AND c.deleted_at IS NULL
     LEFT JOIN invoices i ON i.id = d.invoice_id AND i.deleted_at IS NULL
     WHERE ${where}
     ORDER BY ${sort} ${dir}
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );
  return { rows: data.rows, total };
}

export async function findDisputeById(
  tenantId: string,
  id: string,
): Promise<(DisputeRow & { credit_notes: CreditNoteRow[] }) | null> {
  const res = await queryDb<DisputeRow>(
    `SELECT d.*,
            c.display_name AS customer_display_name,
            i.invoice_number
     FROM disputes d
     LEFT JOIN customers c ON c.id = d.customer_id AND c.deleted_at IS NULL
     LEFT JOIN invoices i ON i.id = d.invoice_id AND i.deleted_at IS NULL
     WHERE d.id = $1 AND d.tenant_id = $2 AND d.deleted_at IS NULL`,
    [id, tenantId],
  );
  if (!res.rows[0]) return null;

  const creditNotes = await queryDb<CreditNoteRow>(
    `SELECT * FROM credit_notes
     WHERE tenant_id = $1 AND dispute_id = $2 AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [tenantId, id],
  );

  return { ...res.rows[0], credit_notes: creditNotes.rows };
}

export async function createDispute(
  tenantId: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<DisputeRow> {
  const res = await queryDb<DisputeRow>(
    `INSERT INTO disputes (
       tenant_id, invoice_id, customer_id,
       dispute_number, status, reason, description,
       disputed_amount, priority, assigned_to,
       created_by, updated_by
     ) VALUES (
       $1, $2, $3,
       $4, 'open', $5, $6,
       $7, $8, $9,
       $10, $10
     ) RETURNING *`,
    [
      tenantId,
      data.invoice_id,
      data.customer_id,
      data.dispute_number,
      data.reason,
      data.description,
      data.disputed_amount,
      data.priority || 'normal',
      data.assigned_to || null,
      userId,
    ],
  );
  return res.rows[0];
}

export async function updateDispute(
  tenantId: string,
  id: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<DisputeRow | null> {
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
  if (sets.length === 0) return findDisputeByIdSimple(tenantId, id);

  sets.push(`updated_by = $${pi}`); params.push(userId); pi++;
  params.push(id); params.push(tenantId);

  const res = await queryDb<DisputeRow>(
    `UPDATE disputes SET ${sets.join(', ')}
     WHERE id = $${pi - 1} AND tenant_id = $${pi} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

async function findDisputeByIdSimple(tenantId: string, id: string): Promise<DisputeRow | null> {
  const res = await queryDb<DisputeRow>(
    `SELECT * FROM disputes WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [id, tenantId],
  );
  return res.rows[0] || null;
}

export async function resolveDispute(
  tenantId: string,
  id: string,
  status: string,
  resolutionNotes: string,
  userId: string,
): Promise<DisputeRow | null> {
  const res = await queryDb<DisputeRow>(
    `UPDATE disputes SET
       status = $1,
       resolution_notes = $2,
       resolved_by = $3,
       resolved_at = NOW(),
       updated_by = $3
     WHERE id = $4 AND tenant_id = $5 AND deleted_at IS NULL
     RETURNING *`,
    [status, resolutionNotes, userId, id, tenantId],
  );
  return res.rows[0] || null;
}

export async function generateDisputeNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const res = await queryDb<SeqRow>(
    `SELECT COUNT(*) + 1 AS next_num FROM disputes
     WHERE tenant_id = $1 AND dispute_number LIKE $2`,
    [tenantId, `DSP-${year}-%`],
  );
  const nextNum = parseInt(res.rows[0].next_num, 10);
  return `DSP-${year}-${String(nextNum).padStart(4, '0')}`;
}

export async function getInvoiceTotal(tenantId: string, invoiceId: string): Promise<number | null> {
  const res = await queryDb<InvoiceTotalRow>(
    `SELECT total FROM invoices WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [invoiceId, tenantId],
  );
  if (!res.rows[0]) return null;
  return Number(res.rows[0].total);
}

export async function invoiceExists(tenantId: string, invoiceId: string): Promise<boolean> {
  const res = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM invoices WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [invoiceId, tenantId],
  );
  return parseInt(res.rows[0].count, 10) > 0;
}

export async function customerExists(tenantId: string, customerId: string): Promise<boolean> {
  const res = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM customers WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [customerId, tenantId],
  );
  return parseInt(res.rows[0].count, 10) > 0;
}

export async function updateInvoiceStatus(
  tenantId: string,
  invoiceId: string,
  status: string,
  userId: string,
): Promise<void> {
  await queryDb(
    `UPDATE invoices SET status = $1, updated_by = $2
     WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL`,
    [status, userId, invoiceId, tenantId],
  );
}

// ======== CREDIT NOTES ========

export async function findAllCreditNotes(
  tenantId: string,
  query: CreditNoteQuery,
): Promise<{ rows: CreditNoteRow[]; total: number }> {
  const conds: string[] = ['cn.tenant_id = $1', 'cn.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;

  if (query.status) { conds.push(`cn.status = $${pi}`); params.push(query.status); pi++; }
  if (query.customer_id) { conds.push(`cn.customer_id = $${pi}`); params.push(query.customer_id); pi++; }
  if (query.invoice_id) { conds.push(`cn.invoice_id = $${pi}`); params.push(query.invoice_id); pi++; }

  const where = conds.join(' AND ');
  const sort = CN_SORT_MAP[query.sortBy] || 'cn.created_at';
  const dir = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (query.page - 1) * query.limit;

  const cnt = await queryDb<CountRow>(`SELECT COUNT(*) AS count FROM credit_notes cn WHERE ${where}`, params);
  const total = parseInt(cnt.rows[0].count, 10);

  const data = await queryDb<CreditNoteRow>(
    `SELECT cn.*,
            c.display_name AS customer_display_name,
            i.invoice_number
     FROM credit_notes cn
     LEFT JOIN customers c ON c.id = cn.customer_id AND c.deleted_at IS NULL
     LEFT JOIN invoices i ON i.id = cn.invoice_id AND i.deleted_at IS NULL
     WHERE ${where}
     ORDER BY ${sort} ${dir}
     LIMIT $${pi} OFFSET $${pi + 1}`,
    [...params, query.limit, offset],
  );
  return { rows: data.rows, total };
}

export async function findCreditNoteById(
  tenantId: string,
  id: string,
): Promise<CreditNoteRow | null> {
  const res = await queryDb<CreditNoteRow>(
    `SELECT cn.*,
            c.display_name AS customer_display_name,
            i.invoice_number
     FROM credit_notes cn
     LEFT JOIN customers c ON c.id = cn.customer_id AND c.deleted_at IS NULL
     LEFT JOIN invoices i ON i.id = cn.invoice_id AND i.deleted_at IS NULL
     WHERE cn.id = $1 AND cn.tenant_id = $2 AND cn.deleted_at IS NULL`,
    [id, tenantId],
  );
  return res.rows[0] || null;
}

export async function createCreditNote(
  tenantId: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<CreditNoteRow> {
  const res = await queryDb<CreditNoteRow>(
    `INSERT INTO credit_notes (
       tenant_id, invoice_id, dispute_id, customer_id,
       credit_note_number, status, amount, reason,
       created_by, updated_by
     ) VALUES (
       $1, $2, $3, $4,
       $5, 'draft', $6, $7,
       $8, $8
     ) RETURNING *`,
    [
      tenantId,
      data.invoice_id,
      data.dispute_id || null,
      data.customer_id,
      data.credit_note_number,
      data.amount,
      data.reason,
      userId,
    ],
  );
  return res.rows[0];
}

export async function approveCreditNote(
  tenantId: string,
  id: string,
  userId: string,
): Promise<CreditNoteRow | null> {
  const res = await queryDb<CreditNoteRow>(
    `UPDATE credit_notes SET status = 'approved', updated_by = $1
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
     RETURNING *`,
    [userId, id, tenantId],
  );
  return res.rows[0] || null;
}

export async function applyCreditNote(
  tenantId: string,
  id: string,
  userId: string,
): Promise<CreditNoteRow | null> {
  const res = await queryDb<CreditNoteRow>(
    `UPDATE credit_notes SET
       status = 'applied',
       applied_at = NOW(),
       applied_by = $1,
       updated_by = $1
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
     RETURNING *`,
    [userId, id, tenantId],
  );
  return res.rows[0] || null;
}

export async function voidCreditNote(
  tenantId: string,
  id: string,
  userId: string,
): Promise<CreditNoteRow | null> {
  const res = await queryDb<CreditNoteRow>(
    `UPDATE credit_notes SET status = 'voided', updated_by = $1
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL
     RETURNING *`,
    [userId, id, tenantId],
  );
  return res.rows[0] || null;
}

export async function generateCreditNoteNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const res = await queryDb<SeqRow>(
    `SELECT COUNT(*) + 1 AS next_num FROM credit_notes
     WHERE tenant_id = $1 AND credit_note_number LIKE $2`,
    [tenantId, `CN-${year}-%`],
  );
  const nextNum = parseInt(res.rows[0].next_num, 10);
  return `CN-${year}-${String(nextNum).padStart(4, '0')}`;
}

export async function adjustInvoiceAmountPaid(
  tenantId: string,
  invoiceId: string,
  adjustment: number,
): Promise<void> {
  await queryDb(
    `UPDATE invoices SET amount_paid = amount_paid + $1
     WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
    [adjustment, invoiceId, tenantId],
  );
}

// --- Stats ---

export async function getStats(tenantId: string): Promise<{
  openCount: string;
  underReviewCount: string;
  totalDisputedAmount: string;
  avgResolutionDays: string;
}> {
  const openRes = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM disputes
     WHERE tenant_id = $1 AND status = 'open' AND deleted_at IS NULL`,
    [tenantId],
  );

  const reviewRes = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM disputes
     WHERE tenant_id = $1 AND status = 'under_review' AND deleted_at IS NULL`,
    [tenantId],
  );

  const amountRes = await queryDb<{ total: string }>(
    `SELECT COALESCE(SUM(disputed_amount), 0)::text AS total FROM disputes
     WHERE tenant_id = $1 AND status IN ('open', 'under_review') AND deleted_at IS NULL`,
    [tenantId],
  );

  const avgRes = await queryDb<{ avg_days: string }>(
    `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400), 0)::text AS avg_days
     FROM disputes
     WHERE tenant_id = $1 AND resolved_at IS NOT NULL AND deleted_at IS NULL`,
    [tenantId],
  );

  return {
    openCount: openRes.rows[0].count,
    underReviewCount: reviewRes.rows[0].count,
    totalDisputedAmount: amountRes.rows[0].total,
    avgResolutionDays: avgRes.rows[0].avg_days,
  };
}
