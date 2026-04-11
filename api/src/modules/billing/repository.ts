import type pg from 'pg';
import { queryDb, getClient } from '../../config/database.js';
import type { DraftQuery, ScheduleQuery } from './schema.js';

// === Interfaces ===

export interface BillingScheduleEntry {
  id: string;
  tenant_id: string;
  contract_id: string;
  billing_period_start: string;
  billing_period_end: string;
  billing_date: string;
  invoice_number_in_season: number;
  total_invoices_in_season: number;
  planned_amount: string | null;
  status: string;
  invoice_draft_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface BillingScheduleInsert {
  tenant_id: string;
  contract_id: string;
  billing_period_start: Date;
  billing_period_end: Date;
  billing_date: Date;
  invoice_number_in_season: number;
  total_invoices_in_season: number;
  planned_amount: number | null;
  status: string;
}

export interface InvoiceDraft {
  id: string;
  tenant_id: string;
  customer_id: string;
  contract_id: string | null;
  billing_schedule_id: string | null;
  draft_number: string;
  line_items: unknown;
  subtotal: string;
  tax_rate: string;
  tax_amount: string;
  total_amount: string;
  description: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  approved_by: string | null;
  approved_at: Date | null;
  pushed_to_xero: boolean;
  xero_invoice_id: string | null;
  invoice_id: string | null;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface BillingMilestone {
  id: string;
  tenant_id: string;
  job_id: string;
  contract_id: string | null;
  customer_id?: string;
  milestone_name: string;
  milestone_description: string | null;
  amount_type: string;
  amount_value: string;
  computed_amount: string | null;
  project_total: string | null;
  status: string;
  invoice_id: string | null;
  xero_invoice_id: string | null;
  sort_order: number;
  due_date: string | null;
  triggered_at: Date | null;
  paid_at: Date | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

interface CountRow { count: string }

interface DraftSeqRow { next_val: number }

// === Billing Schedule ===

export async function bulkInsertSchedule(
  client: pg.PoolClient,
  entries: BillingScheduleInsert[],
): Promise<number> {
  if (entries.length === 0) return 0;

  const values: unknown[] = [];
  const placeholders: string[] = [];
  let idx = 1;

  for (const e of entries) {
    placeholders.push(`($${idx},$${idx + 1},$${idx + 2},$${idx + 3},$${idx + 4},$${idx + 5},$${idx + 6},$${idx + 7},$${idx + 8})`);
    values.push(e.tenant_id, e.contract_id, e.billing_period_start, e.billing_period_end,
      e.billing_date, e.invoice_number_in_season, e.total_invoices_in_season,
      e.planned_amount, e.status);
    idx += 9;
  }

  const result = await client.query(
    `INSERT INTO billing_schedule
     (tenant_id, contract_id, billing_period_start, billing_period_end,
      billing_date, invoice_number_in_season, total_invoices_in_season,
      planned_amount, status)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (contract_id, billing_period_start) DO NOTHING
     RETURNING id`,
    values,
  );
  return result.rowCount ?? 0;
}

export async function findDueScheduleEntries(
  tenantId: string,
  billingDate: string,
): Promise<BillingScheduleEntry[]> {
  const result = await queryDb<BillingScheduleEntry>(
    `SELECT * FROM billing_schedule
     WHERE tenant_id = $1 AND billing_date <= $2 AND status = 'scheduled'
     ORDER BY billing_date ASC`,
    [tenantId, billingDate],
  );
  return result.rows;
}

export async function findSchedule(
  tenantId: string,
  query: ScheduleQuery,
): Promise<{ rows: BillingScheduleEntry[]; total: number }> {
  const conditions: string[] = ['tenant_id = $1'];
  const params: unknown[] = [tenantId];
  let paramIdx = 2;

  if (query.contract_id) {
    conditions.push(`contract_id = $${paramIdx}`);
    params.push(query.contract_id);
    paramIdx++;
  }
  if (query.status) {
    conditions.push(`status = $${paramIdx}`);
    params.push(query.status);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const offset = (query.page - 1) * query.limit;

  const countResult = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM billing_schedule WHERE ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await queryDb<BillingScheduleEntry>(
    `SELECT * FROM billing_schedule WHERE ${where}
     ORDER BY billing_date ASC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, query.limit, offset],
  );
  return { rows: dataResult.rows, total };
}

export async function updateScheduleStatus(
  client: pg.PoolClient,
  entryId: string,
  status: string,
  draftId?: string,
): Promise<void> {
  if (draftId) {
    await client.query(
      `UPDATE billing_schedule SET status = $1, invoice_draft_id = $2 WHERE id = $3`,
      [status, draftId, entryId],
    );
  } else {
    await client.query(
      `UPDATE billing_schedule SET status = $1 WHERE id = $2`,
      [status, entryId],
    );
  }
}

// === Invoice Drafts ===

export async function getNextDraftNumber(client: pg.PoolClient, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const shortYear = String(year).slice(-2);
  const result = await client.query<DraftSeqRow>(
    `INSERT INTO job_number_seq (tenant_id, seq_year, next_val, updated_at)
     VALUES ($1, $2, 2, NOW())
     ON CONFLICT (tenant_id, seq_year)
     DO UPDATE SET next_val = job_number_seq.next_val + 1, updated_at = NOW()
     RETURNING next_val - 1 AS next_val`,
    [tenantId, year + 20000],
  );
  const num = result.rows[0].next_val;
  return `DRF-${String(num).padStart(4, '0')}-${shortYear}`;
}

export async function insertDraft(
  client: pg.PoolClient,
  draft: Record<string, unknown>,
): Promise<InvoiceDraft> {
  const draftNumber = await getNextDraftNumber(client, draft.tenant_id as string);
  const result = await client.query<InvoiceDraft>(
    `INSERT INTO invoice_drafts
     (tenant_id, customer_id, contract_id, billing_schedule_id,
      draft_number, line_items, subtotal, total_amount, description, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      draft.tenant_id, draft.customer_id, draft.contract_id ?? null,
      draft.billing_schedule_id ?? null, draftNumber,
      JSON.stringify(draft.line_items), draft.subtotal, draft.total_amount,
      draft.description ?? null, draft.status ?? 'pending_review',
    ],
  );
  return result.rows[0];
}

export async function getDraftById(
  tenantId: string,
  draftId: string,
): Promise<InvoiceDraft | null> {
  const result = await queryDb<InvoiceDraft>(
    `SELECT * FROM invoice_drafts WHERE id = $1 AND tenant_id = $2`,
    [draftId, tenantId],
  );
  return result.rows[0] || null;
}

export async function findDrafts(
  tenantId: string,
  query: DraftQuery,
): Promise<{ rows: InvoiceDraft[]; total: number }> {
  const conditions: string[] = ['tenant_id = $1'];
  const params: unknown[] = [tenantId];
  let paramIdx = 2;

  if (query.status) {
    conditions.push(`status = $${paramIdx}`);
    params.push(query.status);
    paramIdx++;
  }
  if (query.customer_id) {
    conditions.push(`customer_id = $${paramIdx}`);
    params.push(query.customer_id);
    paramIdx++;
  }
  if (query.contract_id) {
    conditions.push(`contract_id = $${paramIdx}`);
    params.push(query.contract_id);
    paramIdx++;
  }

  const where = conditions.join(' AND ');
  const offset = (query.page - 1) * query.limit;

  const countResult = await queryDb<CountRow>(
    `SELECT COUNT(*) AS count FROM invoice_drafts WHERE ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await queryDb<InvoiceDraft>(
    `SELECT * FROM invoice_drafts WHERE ${where}
     ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, query.limit, offset],
  );
  return { rows: dataResult.rows, total };
}

export async function updateDraft(
  client: pg.PoolClient,
  draftId: string,
  data: Record<string, unknown>,
): Promise<InvoiceDraft> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  const fields: Array<[string, unknown]> = [
    ['line_items', data.line_items !== undefined ? JSON.stringify(data.line_items) : undefined],
    ['subtotal', data.subtotal],
    ['total_amount', data.total_amount],
    ['description', data.description],
    ['status', data.status],
    ['reviewed_by', data.reviewed_by],
    ['reviewed_at', data.reviewed_at],
    ['approved_by', data.approved_by],
    ['approved_at', data.approved_at],
    ['pushed_to_xero', data.pushed_to_xero],
    ['xero_invoice_id', data.xero_invoice_id],
    ['invoice_id', data.invoice_id],
    ['rejection_reason', data.rejection_reason],
  ];

  for (const [col, val] of fields) {
    if (val !== undefined) {
      setClauses.push(`${col} = $${paramIdx}`);
      params.push(val ?? null);
      paramIdx++;
    }
  }

  if (setClauses.length === 0) {
    const r = await client.query<InvoiceDraft>(`SELECT * FROM invoice_drafts WHERE id = $1`, [draftId]);
    return r.rows[0];
  }

  params.push(draftId);
  const result = await client.query<InvoiceDraft>(
    `UPDATE invoice_drafts SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params,
  );
  return result.rows[0];
}

// === Billing Milestones ===

export async function getMilestoneById(
  tenantId: string,
  milestoneId: string,
): Promise<BillingMilestone | null> {
  const result = await queryDb<BillingMilestone>(
    `SELECT bm.*, j.customer_id
     FROM billing_milestones bm
     JOIN jobs j ON j.id = bm.job_id
     WHERE bm.id = $1 AND bm.tenant_id = $2`,
    [milestoneId, tenantId],
  );
  return result.rows[0] || null;
}

export async function updateMilestone(
  client: pg.PoolClient,
  milestoneId: string,
  data: Record<string, unknown>,
): Promise<BillingMilestone> {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  for (const [col, val] of Object.entries(data)) {
    if (val !== undefined) {
      setClauses.push(`${col} = $${paramIdx}`);
      params.push(val ?? null);
      paramIdx++;
    }
  }

  params.push(milestoneId);
  const result = await client.query<BillingMilestone>(
    `UPDATE billing_milestones SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params,
  );
  return result.rows[0];
}

// === Dashboard ===

interface DashboardStats {
  pending_review: string;
  total_scheduled: string;
  total_approved: string;
  overdue_count: string;
}

export async function getDashboardStats(tenantId: string): Promise<DashboardStats> {
  const result = await queryDb<DashboardStats>(
    `SELECT
       COUNT(*) FILTER (WHERE d.status = 'pending_review')::text AS pending_review,
       (SELECT COUNT(*)::text FROM billing_schedule WHERE tenant_id = $1 AND status = 'scheduled') AS total_scheduled,
       COUNT(*) FILTER (WHERE d.status = 'pushed_to_xero')::text AS total_approved,
       (SELECT COUNT(*)::text FROM billing_schedule WHERE tenant_id = $1 AND status = 'scheduled' AND billing_date < CURRENT_DATE) AS overdue_count
     FROM invoice_drafts d WHERE d.tenant_id = $1`,
    [tenantId],
  );
  return result.rows[0];
}

export async function findOverdue(tenantId: string): Promise<BillingScheduleEntry[]> {
  const result = await queryDb<BillingScheduleEntry>(
    `SELECT * FROM billing_schedule
     WHERE tenant_id = $1 AND status = 'scheduled' AND billing_date < CURRENT_DATE
     ORDER BY billing_date ASC`,
    [tenantId],
  );
  return result.rows;
}

// === Milestone CRUD ===

export async function findMilestonesByJobId(
  jobId: string,
  tenantId: string,
): Promise<BillingMilestone[]> {
  const result = await queryDb<BillingMilestone>(
    `SELECT bm.*, j.customer_id
     FROM billing_milestones bm
     JOIN jobs j ON j.id = bm.job_id
     WHERE bm.job_id = $1 AND bm.tenant_id = $2
     ORDER BY bm.sort_order ASC`,
    [jobId, tenantId],
  );
  return result.rows;
}

export async function createMilestones(
  client: pg.PoolClient,
  jobId: string,
  tenantId: string,
  milestones: Array<Record<string, unknown>>,
): Promise<BillingMilestone[]> {
  const results: BillingMilestone[] = [];
  for (const m of milestones) {
    const result = await client.query<BillingMilestone>(
      `INSERT INTO billing_milestones
       (tenant_id, job_id, contract_id, milestone_name, milestone_description,
        amount_type, amount_value, computed_amount, project_total, sort_order,
        due_date, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12)
       RETURNING *`,
      [
        tenantId, jobId, m.contract_id ?? null,
        m.milestone_name, m.milestone_description ?? null,
        m.amount_type, m.amount_value, m.computed_amount, m.project_total,
        m.sort_order ?? 0, m.due_date ?? null, m.created_by ?? null,
      ],
    );
    results.push(result.rows[0]);
  }
  return results;
}

export async function createSingleMilestone(
  client: pg.PoolClient,
  jobId: string,
  tenantId: string,
  data: Record<string, unknown>,
): Promise<BillingMilestone> {
  const result = await client.query<BillingMilestone>(
    `INSERT INTO billing_milestones
     (tenant_id, job_id, contract_id, milestone_name, milestone_description,
      amount_type, amount_value, computed_amount, project_total, sort_order,
      due_date, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12)
     RETURNING *`,
    [
      tenantId, jobId, data.contract_id ?? null,
      data.milestone_name, data.milestone_description ?? null,
      data.amount_type, data.amount_value, data.computed_amount, data.project_total,
      data.sort_order ?? 0, data.due_date ?? null, data.created_by ?? null,
    ],
  );
  return result.rows[0];
}

export async function cancelMilestone(
  client: pg.PoolClient,
  milestoneId: string,
  tenantId: string,
  reason: string,
  userId: string,
): Promise<BillingMilestone> {
  const result = await client.query<BillingMilestone>(
    `UPDATE billing_milestones
     SET status = 'cancelled', notes = $1, updated_by = $2
     WHERE id = $3 AND tenant_id = $4
     RETURNING *`,
    [reason, userId, milestoneId, tenantId],
  );
  return result.rows[0];
}

export async function getHardscapeBillingSummary(
  tenantId: string,
): Promise<Array<Record<string, unknown>>> {
  const result = await queryDb<Record<string, unknown>>(
    `SELECT j.id AS job_id, j.title AS job_title, j.status AS job_status,
            c.display_name AS customer_name,
            COUNT(bm.id)::int AS total_milestones,
            COALESCE(SUM(bm.computed_amount) FILTER (WHERE bm.status != 'cancelled'), 0)::numeric AS project_total,
            COALESCE(SUM(bm.computed_amount) FILTER (WHERE bm.status IN ('invoiced', 'approved', 'paid')), 0)::numeric AS invoiced_to_date,
            COALESCE(SUM(bm.computed_amount) FILTER (WHERE bm.status = 'paid'), 0)::numeric AS collected,
            COUNT(bm.id) FILTER (WHERE bm.status = 'pending')::int AS pending_count,
            COUNT(bm.id) FILTER (WHERE bm.status = 'paid')::int AS paid_count
     FROM billing_milestones bm
     JOIN jobs j ON j.id = bm.job_id AND j.deleted_at IS NULL
     LEFT JOIN customers c ON c.id = j.customer_id AND c.deleted_at IS NULL
     WHERE bm.tenant_id = $1 AND j.division = 'hardscape'
     GROUP BY j.id, j.title, j.status, c.display_name
     ORDER BY j.created_at DESC`,
    [tenantId],
  );
  return result.rows;
}

export async function acquireClient(): Promise<pg.PoolClient> {
  return getClient();
}
