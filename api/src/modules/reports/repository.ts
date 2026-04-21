import { queryDb } from '../../config/database.js';

// --- Result types ---

// Wave 7 Brief 04 (I-5) Service Package Analytics row shapes
export interface SeasonCompletionRow {
  service_code: string;
  service_name: string;
  per_season: number;
  total: number;
  done: number;
  assigned: number;
  pending: number;
  skipped: number;
  completion_rate: number;
}
export interface OccurrenceStatusRow {
  occurrence_id: string;
  service_code: string;
  service_name: string;
  occurrence_number: number;
  status: string;
  assigned_date: string | null;
  preferred_month: string | null;
  customer_id: string;
  customer_name: string;
  customer_number: string | null;
  property_id: string;
  street_address: string | null;
  city: string | null;
  property_category: string | null;
  job_id: string | null;
  job_number: string | null;
  service_tier: string;
}
export interface SkippedVisitRow {
  id: string;
  skipped_date: string | null;
  skipped_reason: string | null;
  recovery_date: string | null;
  occurrence_number: number;
  service_name: string;
  is_included_in_invoice: boolean;
  customer_name: string;
  customer_number: string | null;
  street_address: string | null;
  service_tier: string;
  bronze_billing_type: string | null;
}
export interface TierPerformanceRow {
  tier: string;
  active_contracts: number;
  season_revenue: number;
  avg_contract_value: number;
  total_occurrences: number;
  skipped_visits: number;
  service_completion_rate: number | null;
  clients_retained_pct: number;
}

export interface RevenueRow { period: string; revenue: string; }
export interface RevenueDivisionRow { division: string; revenue: string; }
export interface RevenueCustomerRow { customer_id: string; customer_name: string; revenue: string; invoice_count: string; }
export interface AgingRow { bucket: string; total: string; count: string; }
export interface ContractRenewalRow { id: string; contract_number: string; customer_name: string; end_date: string; total_value: string; division: string | null; days_until_expiry: string; }
export interface CrewProductivityRow { crew_id: string; crew_name: string; jobs_completed: string; total_estimated_minutes: string; total_actual_minutes: string; avg_efficiency: string; }
export interface TimeTrackingRow { user_id: string; user_name: string; crew_name: string | null; total_hours: string; regular_hours: string; overtime_hours: string; division: string | null; }
export interface SnowProfitRow { season_id: string; season_name: string; total_runs: string; total_entries: string; total_revenue: string; total_labor_cost: string; profit: string; }
export interface PipelineRow { stage: string; count: string; total_value: string; avg_value: string; }
export interface PipelineWinRow { total_projects: string; won: string; lost: string; win_rate: string; avg_days_to_close: string; }
export interface ProspectConversionRow { source: string; total: string; converted: string; conversion_rate: string; total_value: string; }
export interface EquipmentSummaryRow { status: string; count: string; }
export interface MaterialUsageRow { category: string; month: string; total_quantity: string; total_cost: string; }
interface CountRow { count: string; }

// ============================================
// Revenue Reports
// ============================================

export async function getRevenueSummary(
  tenantId: string,
  dateFrom?: string,
  dateTo?: string,
  division?: string,
): Promise<{ monthly: RevenueRow[]; ytd: string; priorYtd: string }> {
  const conds: string[] = ['tenant_id = $1', "status IN ('paid', 'partially_paid')", 'deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;

  if (division) { conds.push(`division = $${pi}`); params.push(division); pi++; }

  const currentYear = new Date().getFullYear();

  // Monthly revenue
  const monthConds = [...conds];
  const monthParams = [...params];
  if (dateFrom) { monthConds.push(`invoice_date >= $${pi}`); monthParams.push(dateFrom); pi++; }
  if (dateTo) { monthConds.push(`invoice_date <= $${pi}`); monthParams.push(dateTo); pi++; }

  const monthly = await queryDb<RevenueRow>(
    `SELECT TO_CHAR(invoice_date, 'YYYY-MM') AS period,
            COALESCE(SUM(total), 0)::text AS revenue
     FROM invoices
     WHERE ${monthConds.join(' AND ')}
     GROUP BY TO_CHAR(invoice_date, 'YYYY-MM')
     ORDER BY period DESC
     LIMIT 24`,
    monthParams,
  );

  // YTD
  const ytdRes = await queryDb<{ total: string }>(
    `SELECT COALESCE(SUM(total), 0)::text AS total FROM invoices
     WHERE ${conds.join(' AND ')}
       AND EXTRACT(YEAR FROM invoice_date) = $${pi}`,
    [...params, currentYear],
  );

  // Prior year YTD (same day range)
  const priorRes = await queryDb<{ total: string }>(
    `SELECT COALESCE(SUM(total), 0)::text AS total FROM invoices
     WHERE ${conds.join(' AND ')}
       AND EXTRACT(YEAR FROM invoice_date) = $${pi}
       AND EXTRACT(DOY FROM invoice_date) <= EXTRACT(DOY FROM CURRENT_DATE)`,
    [...params, currentYear - 1],
  );

  return {
    monthly: monthly.rows,
    ytd: ytdRes.rows[0].total,
    priorYtd: priorRes.rows[0].total,
  };
}

export async function getRevenueByDivision(
  tenantId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<RevenueDivisionRow[]> {
  const conds: string[] = ['tenant_id = $1', "status IN ('paid', 'partially_paid')", 'deleted_at IS NULL', 'division IS NOT NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;

  if (dateFrom) { conds.push(`invoice_date >= $${pi}`); params.push(dateFrom); pi++; }
  if (dateTo) { conds.push(`invoice_date <= $${pi}`); params.push(dateTo); pi++; }

  const res = await queryDb<RevenueDivisionRow>(
    `SELECT division, COALESCE(SUM(total), 0)::text AS revenue
     FROM invoices
     WHERE ${conds.join(' AND ')}
     GROUP BY division
     ORDER BY revenue DESC`,
    params,
  );
  return res.rows;
}

export async function getRevenueByCustomer(
  tenantId: string,
  dateFrom?: string,
  dateTo?: string,
  limit: number = 10,
): Promise<RevenueCustomerRow[]> {
  const conds: string[] = ['i.tenant_id = $1', "i.status IN ('paid', 'partially_paid')", 'i.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;

  if (dateFrom) { conds.push(`i.invoice_date >= $${pi}`); params.push(dateFrom); pi++; }
  if (dateTo) { conds.push(`i.invoice_date <= $${pi}`); params.push(dateTo); pi++; }

  const res = await queryDb<RevenueCustomerRow>(
    `SELECT i.customer_id,
            c.display_name AS customer_name,
            COALESCE(SUM(i.total), 0)::text AS revenue,
            COUNT(i.id)::text AS invoice_count
     FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id AND c.deleted_at IS NULL
     WHERE ${conds.join(' AND ')}
     GROUP BY i.customer_id, c.display_name
     ORDER BY SUM(i.total) DESC
     LIMIT $${pi}`,
    [...params, limit],
  );
  return res.rows;
}

// ============================================
// Invoice Aging
// ============================================

export async function getInvoiceAging(
  tenantId: string,
  division?: string,
): Promise<AgingRow[]> {
  const conds: string[] = ['tenant_id = $1', "status IN ('sent', 'viewed', 'overdue', 'partially_paid')", 'deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;

  if (division) { conds.push(`division = $${pi}`); params.push(division); pi++; }

  const res = await queryDb<AgingRow>(
    `SELECT
       CASE
         WHEN due_date >= CURRENT_DATE THEN 'current'
         WHEN due_date >= CURRENT_DATE - INTERVAL '30 days' THEN '30_days'
         WHEN due_date >= CURRENT_DATE - INTERVAL '60 days' THEN '60_days'
         ELSE '90_plus'
       END AS bucket,
       COALESCE(SUM(balance_due), 0)::text AS total,
       COUNT(*)::text AS count
     FROM invoices
     WHERE ${conds.join(' AND ')}
     GROUP BY bucket
     ORDER BY CASE bucket
       WHEN 'current' THEN 1
       WHEN '30_days' THEN 2
       WHEN '60_days' THEN 3
       ELSE 4
     END`,
    params,
  );
  return res.rows;
}

// ============================================
// Contract Renewals
// ============================================

export async function getContractRenewals(
  tenantId: string,
  daysAhead: number = 90,
): Promise<ContractRenewalRow[]> {
  const res = await queryDb<ContractRenewalRow>(
    `SELECT sc.id, sc.contract_number,
            c.display_name AS customer_name,
            sc.end_date::text,
            COALESCE(sc.total_value, 0)::text AS total_value,
            sc.division,
            (sc.end_date - CURRENT_DATE)::text AS days_until_expiry
     FROM service_contracts sc
     LEFT JOIN customers c ON c.id = sc.customer_id AND c.deleted_at IS NULL
     WHERE sc.tenant_id = $1
       AND sc.status = 'active'
       AND sc.end_date IS NOT NULL
       AND sc.end_date <= CURRENT_DATE + $2 * INTERVAL '1 day'
       AND sc.deleted_at IS NULL
     ORDER BY sc.end_date ASC`,
    [tenantId, daysAhead],
  );
  return res.rows;
}

// ============================================
// Crew Productivity
// ============================================

export async function getCrewProductivity(
  tenantId: string,
  dateFrom?: string,
  dateTo?: string,
  division?: string,
): Promise<CrewProductivityRow[]> {
  const conds: string[] = ['j.tenant_id = $1', "j.status = 'completed'", 'j.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;

  if (dateFrom) { conds.push(`j.completed_at >= $${pi}`); params.push(dateFrom); pi++; }
  if (dateTo) { conds.push(`j.completed_at <= $${pi}`); params.push(dateTo); pi++; }
  if (division) { conds.push(`j.division = $${pi}`); params.push(division); pi++; }

  const res = await queryDb<CrewProductivityRow>(
    `SELECT j.crew_id,
            cr.crew_name,
            COUNT(j.id)::text AS jobs_completed,
            COALESCE(SUM(j.estimated_duration_minutes), 0)::text AS total_estimated_minutes,
            COALESCE(SUM(j.actual_duration_minutes), 0)::text AS total_actual_minutes,
            CASE
              WHEN SUM(j.actual_duration_minutes) > 0
              THEN ROUND(SUM(j.estimated_duration_minutes)::numeric / SUM(j.actual_duration_minutes)::numeric * 100, 1)::text
              ELSE '0'
            END AS avg_efficiency
     FROM jobs j
     LEFT JOIN crews cr ON cr.id = j.crew_id AND cr.deleted_at IS NULL
     WHERE ${conds.join(' AND ')}
       AND j.crew_id IS NOT NULL
     GROUP BY j.crew_id, cr.crew_name
     ORDER BY COUNT(j.id) DESC`,
    params,
  );
  return res.rows;
}

// ============================================
// Time Tracking Summary
// ============================================

export async function getTimeTrackingSummary(
  tenantId: string,
  dateFrom?: string,
  dateTo?: string,
  division?: string,
): Promise<TimeTrackingRow[]> {
  const conds: string[] = ['te.tenant_id = $1', "te.status = 'approved'", 'te.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;

  if (dateFrom) { conds.push(`te.clock_in >= $${pi}`); params.push(dateFrom); pi++; }
  if (dateTo) { conds.push(`te.clock_in <= $${pi}`); params.push(dateTo); pi++; }
  if (division) { conds.push(`te.division = $${pi}`); params.push(division); pi++; }

  const res = await queryDb<TimeTrackingRow>(
    `SELECT te.user_id,
            u.first_name || ' ' || u.last_name AS user_name,
            cr.crew_name,
            ROUND(COALESCE(SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600), 0)::numeric, 2)::text AS total_hours,
            ROUND(LEAST(COALESCE(SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600), 0), 40)::numeric, 2)::text AS regular_hours,
            ROUND(GREATEST(COALESCE(SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600), 0) - 40, 0)::numeric, 2)::text AS overtime_hours,
            te.division
     FROM time_entries te
     LEFT JOIN users u ON u.id = te.user_id
     LEFT JOIN crews cr ON cr.id = te.crew_id AND cr.deleted_at IS NULL
     WHERE ${conds.join(' AND ')}
       AND te.clock_out IS NOT NULL
     GROUP BY te.user_id, u.first_name, u.last_name, cr.crew_name, te.division
     ORDER BY SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in))) DESC`,
    params,
  );
  return res.rows;
}

// ============================================
// Snow Profitability
// ============================================

export async function getSnowProfitability(
  tenantId: string,
  seasonId?: string,
): Promise<SnowProfitRow[]> {
  const conds: string[] = ['s.tenant_id = $1', 's.deleted_at IS NULL'];
  const params: unknown[] = [tenantId];
  let pi = 2;

  if (seasonId) { conds.push(`s.id = $${pi}`); params.push(seasonId); pi++; }

  const res = await queryDb<SnowProfitRow>(
    `SELECT s.id AS season_id,
            s.name AS season_name,
            COUNT(DISTINCT r.id)::text AS total_runs,
            COUNT(DISTINCT e.id)::text AS total_entries,
            COALESCE(SUM(e.billing_amount), 0)::text AS total_revenue,
            COALESCE(SUM(e.labor_cost), 0)::text AS total_labor_cost,
            (COALESCE(SUM(e.billing_amount), 0) - COALESCE(SUM(e.labor_cost), 0))::text AS profit
     FROM snow_seasons s
     LEFT JOIN snow_runs r ON r.season_id = s.id AND r.deleted_at IS NULL
     LEFT JOIN snow_run_entries e ON e.run_id = r.id AND e.deleted_at IS NULL
     WHERE ${conds.join(' AND ')}
     GROUP BY s.id, s.name
     ORDER BY s.start_date DESC`,
    params,
  );
  return res.rows;
}

// ============================================
// Hardscape Pipeline
// ============================================

export async function getHardscapePipeline(
  tenantId: string,
): Promise<{ byStage: PipelineRow[]; metrics: PipelineWinRow }> {
  const stageRes = await queryDb<PipelineRow>(
    `SELECT stage,
            COUNT(*)::text AS count,
            COALESCE(SUM(estimated_value), 0)::text AS total_value,
            COALESCE(AVG(estimated_value), 0)::text AS avg_value
     FROM hardscape_projects
     WHERE tenant_id = $1 AND deleted_at IS NULL
     GROUP BY stage
     ORDER BY CASE stage
       WHEN 'lead' THEN 1 WHEN 'quoting' THEN 2 WHEN 'quoted' THEN 3
       WHEN 'sold' THEN 4 WHEN 'in_progress' THEN 5 WHEN 'completed' THEN 6
       ELSE 7
     END`,
    [tenantId],
  );

  const metricsRes = await queryDb<PipelineWinRow>(
    `SELECT COUNT(*)::text AS total_projects,
            COUNT(*) FILTER (WHERE stage = 'completed')::text AS won,
            COUNT(*) FILTER (WHERE stage = 'lost')::text AS lost,
            CASE
              WHEN COUNT(*) FILTER (WHERE stage IN ('completed', 'lost')) > 0
              THEN ROUND(
                COUNT(*) FILTER (WHERE stage = 'completed')::numeric /
                COUNT(*) FILTER (WHERE stage IN ('completed', 'lost'))::numeric * 100, 1
              )::text
              ELSE '0'
            END AS win_rate,
            COALESCE(AVG(
              CASE WHEN stage IN ('completed', 'lost')
              THEN EXTRACT(DAY FROM (updated_at - created_at))
              END
            ), 0)::text AS avg_days_to_close
     FROM hardscape_projects
     WHERE tenant_id = $1 AND deleted_at IS NULL`,
    [tenantId],
  );

  return {
    byStage: stageRes.rows,
    metrics: metricsRes.rows[0],
  };
}

// ============================================
// Prospect Conversion
// ============================================

export async function getProspectConversion(
  tenantId: string,
): Promise<ProspectConversionRow[]> {
  const res = await queryDb<ProspectConversionRow>(
    `SELECT source,
            COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE status = 'converted')::text AS converted,
            CASE
              WHEN COUNT(*) > 0
              THEN ROUND(COUNT(*) FILTER (WHERE status = 'converted')::numeric / COUNT(*)::numeric * 100, 1)::text
              ELSE '0'
            END AS conversion_rate,
            COALESCE(SUM(estimated_value), 0)::text AS total_value
     FROM prospects
     WHERE tenant_id = $1 AND deleted_at IS NULL
     GROUP BY source
     ORDER BY COUNT(*) DESC`,
    [tenantId],
  );
  return res.rows;
}

// ============================================
// Equipment Summary
// ============================================

export async function getEquipmentSummary(
  tenantId: string,
): Promise<EquipmentSummaryRow[]> {
  const res = await queryDb<EquipmentSummaryRow>(
    `SELECT status, COUNT(*)::text AS count
     FROM equipment
     WHERE tenant_id = $1 AND deleted_at IS NULL
     GROUP BY status
     ORDER BY status`,
    [tenantId],
  );
  return res.rows;
}

// ============================================
// Material Usage
// ============================================

export async function getMaterialUsage(
  tenantId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<MaterialUsageRow[]> {
  const conds: string[] = ['mt.tenant_id = $1'];
  const params: unknown[] = [tenantId];
  let pi = 2;

  if (dateFrom) { conds.push(`mt.transaction_date >= $${pi}`); params.push(dateFrom); pi++; }
  if (dateTo) { conds.push(`mt.transaction_date <= $${pi}`); params.push(dateTo); pi++; }

  const res = await queryDb<MaterialUsageRow>(
    `SELECT m.category,
            TO_CHAR(mt.transaction_date, 'YYYY-MM') AS month,
            COALESCE(SUM(ABS(mt.quantity)), 0)::text AS total_quantity,
            COALESCE(SUM(ABS(mt.quantity) * m.unit_cost), 0)::text AS total_cost
     FROM material_transactions mt
     JOIN materials m ON m.id = mt.material_id AND m.deleted_at IS NULL
     WHERE ${conds.join(' AND ')}
       AND mt.transaction_type = 'usage'
     GROUP BY m.category, TO_CHAR(mt.transaction_date, 'YYYY-MM')
     ORDER BY month DESC, m.category`,
    params,
  );
  return res.rows;
}

// ============================================
// Wave 7 Brief 04 — Service Package Analytics (I-5)
// ============================================

interface SeasonCompletionRawRow {
  service_code: string;
  service_name: string;
  per_season: string;
  total: string;
  done: string;
  assigned: string;
  pending: string;
  skipped: string;
  completion_rate: string | null;
}

export async function getSeasonCompletion(
  tenantId: string,
  seasonYear: number,
  division?: string,
  tier?: string,
): Promise<SeasonCompletionRow[]> {
  const conds: string[] = ['so.tenant_id = $1', 'so.season_year = $2'];
  const params: unknown[] = [tenantId, seasonYear];
  let pi = 3;

  if (tier) {
    conds.push(`sc.service_tier = $${pi}`);
    params.push(tier);
    pi++;
  }
  if (division) {
    conds.push(`sc.division = $${pi}`);
    params.push(division);
    pi++;
  }

  const res = await queryDb<SeasonCompletionRawRow>(
    `SELECT
        so.service_code,
        so.service_name,
        MAX(so.occurrence_number)::text AS per_season,
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE so.status = 'completed')::text AS done,
        COUNT(*) FILTER (WHERE so.status = 'assigned')::text AS assigned,
        COUNT(*) FILTER (WHERE so.status = 'pending')::text AS pending,
        COUNT(*) FILTER (WHERE so.status = 'skipped')::text AS skipped,
        ROUND(
          (COUNT(*) FILTER (WHERE so.status IN ('completed', 'assigned'))::numeric
           / NULLIF(COUNT(*), 0)::numeric) * 100, 1
        )::text AS completion_rate
     FROM service_occurrences so
     JOIN service_contracts sc ON sc.id = so.contract_id AND sc.tenant_id = so.tenant_id
     WHERE ${conds.join(' AND ')}
     GROUP BY so.service_code, so.service_name
     ORDER BY so.service_name`,
    params,
  );

  return res.rows.map((r) => ({
    service_code: r.service_code,
    service_name: r.service_name,
    per_season: Number(r.per_season),
    total: Number(r.total),
    done: Number(r.done),
    assigned: Number(r.assigned),
    pending: Number(r.pending),
    skipped: Number(r.skipped),
    completion_rate: r.completion_rate ? Number(r.completion_rate) : 0,
  }));
}

interface OccurrenceStatusRawRow extends Omit<OccurrenceStatusRow, 'occurrence_number'> {
  occurrence_number: number | string;
}

export async function getOccurrenceStatus(
  tenantId: string,
  serviceCode: string,
  seasonYear: number,
  opts: { status?: string; category?: string; occurrence_number?: number } = {},
): Promise<OccurrenceStatusRow[]> {
  const conds: string[] = ['so.tenant_id = $1', 'so.service_code = $2', 'so.season_year = $3'];
  const params: unknown[] = [tenantId, serviceCode, seasonYear];
  let pi = 4;

  if (opts.status) {
    conds.push(`so.status = $${pi}`);
    params.push(opts.status);
    pi++;
  }
  if (opts.category) {
    conds.push(`p.property_category = $${pi}`);
    params.push(opts.category);
    pi++;
  }
  if (opts.occurrence_number !== undefined) {
    conds.push(`so.occurrence_number = $${pi}`);
    params.push(opts.occurrence_number);
    pi++;
  }

  const res = await queryDb<OccurrenceStatusRawRow>(
    `SELECT
        so.id                    AS occurrence_id,
        so.service_code,
        so.service_name,
        so.occurrence_number,
        so.status,
        so.assigned_date,
        so.preferred_month,
        c.id                     AS customer_id,
        c.display_name           AS customer_name,
        c.customer_number,
        p.id                     AS property_id,
        p.street_address,
        p.city,
        p.property_category,
        j.id                     AS job_id,
        j.job_number,
        sc.service_tier
     FROM service_occurrences so
     JOIN customers c          ON c.id  = so.customer_id
     JOIN properties p         ON p.id  = so.property_id
     JOIN service_contracts sc ON sc.id = so.contract_id
     LEFT JOIN jobs j          ON j.id  = so.job_id
     WHERE ${conds.join(' AND ')}
     ORDER BY c.display_name, p.street_address`,
    params,
  );

  return res.rows.map((r) => ({
    ...r,
    occurrence_number: Number(r.occurrence_number),
  }));
}

interface SkippedVisitRawRow {
  id: string;
  skipped_date: string | null;
  skipped_reason: string | null;
  recovery_date: string | null;
  occurrence_number: number | string;
  service_name: string;
  is_included_in_invoice: boolean;
  customer_name: string;
  customer_number: string | null;
  street_address: string | null;
  service_tier: string;
  bronze_billing_type: string | null;
}

export async function getSkippedVisits(
  tenantId: string,
  seasonYear: number,
  opts: { tier?: string; from_date?: string; to_date?: string } = {},
): Promise<SkippedVisitRow[]> {
  const conds: string[] = ['so.tenant_id = $1', "so.status = 'skipped'", 'so.season_year = $2'];
  const params: unknown[] = [tenantId, seasonYear];
  let pi = 3;

  if (opts.tier) {
    conds.push(`sc.service_tier = $${pi}`);
    params.push(opts.tier);
    pi++;
  }
  if (opts.from_date) {
    conds.push(`so.skipped_date >= $${pi}`);
    params.push(opts.from_date);
    pi++;
  }
  if (opts.to_date) {
    conds.push(`so.skipped_date <= $${pi}`);
    params.push(opts.to_date);
    pi++;
  }

  const res = await queryDb<SkippedVisitRawRow>(
    `SELECT
        so.id,
        so.skipped_date,
        so.skipped_reason,
        so.recovery_date,
        so.occurrence_number,
        so.service_name,
        so.is_included_in_invoice,
        c.display_name           AS customer_name,
        c.customer_number,
        p.street_address,
        sc.service_tier,
        sc.bronze_billing_type
     FROM service_occurrences so
     JOIN customers c          ON c.id  = so.customer_id
     JOIN properties p         ON p.id  = so.property_id
     JOIN service_contracts sc ON sc.id = so.contract_id
     WHERE ${conds.join(' AND ')}
     ORDER BY so.skipped_date DESC NULLS LAST`,
    params,
  );

  return res.rows.map((r) => ({
    ...r,
    occurrence_number: Number(r.occurrence_number),
  }));
}

interface TierPerformanceRawRow {
  tier: string;
  active_contracts: string;
  season_revenue: string;
  avg_contract_value: string | null;
  total_occurrences: string;
  skipped_visits: string;
  service_completion_rate: string | null;
  clients_retained_pct: string | null;
}

export async function getTierPerformance(
  tenantId: string,
  seasonYear: number,
): Promise<TierPerformanceRow[]> {
  // NOTE: the spec references `season_year_active` and `status='active_season'` —
  // neither exists in the current schema (confirmed against migration 029).
  // We substitute EXTRACT(YEAR FROM season_start_date) and status = 'active'.
  const res = await queryDb<TierPerformanceRawRow>(
    `WITH active_contracts AS (
       SELECT sc.service_tier AS tier, COUNT(*)::text AS count
       FROM service_contracts sc
       WHERE sc.tenant_id = $1
         AND EXTRACT(YEAR FROM sc.season_start_date) = $2
         AND sc.status = 'active'
         AND sc.deleted_at IS NULL
       GROUP BY sc.service_tier
     ),
     revenue AS (
       SELECT sc.service_tier AS tier,
              SUM(bs.planned_amount * bs.total_invoices_in_season)::text AS season_revenue
       FROM service_contracts sc
       JOIN billing_schedule bs ON bs.contract_id = sc.id
       WHERE sc.tenant_id = $1
         AND EXTRACT(YEAR FROM sc.season_start_date) = $2
         AND sc.deleted_at IS NULL
       GROUP BY sc.service_tier
     ),
     occurrences AS (
       SELECT sc.service_tier AS tier,
              COUNT(*)::text AS total_occurrences,
              COUNT(*) FILTER (WHERE so.status IN ('completed', 'assigned'))::text AS ok_occ,
              COUNT(*) FILTER (WHERE so.status = 'skipped')::text AS skipped_visits
       FROM service_contracts sc
       LEFT JOIN service_occurrences so
         ON so.contract_id = sc.id AND so.season_year = $2
       WHERE sc.tenant_id = $1
         AND EXTRACT(YEAR FROM sc.season_start_date) = $2
         AND sc.deleted_at IS NULL
       GROUP BY sc.service_tier
     ),
     retention AS (
       SELECT sc.service_tier AS tier,
              ROUND(
                COUNT(DISTINCT CASE WHEN prior.id IS NOT NULL THEN sc.id END)::numeric
                / NULLIF(COUNT(DISTINCT sc.id), 0) * 100, 0
              )::text AS clients_retained_pct
       FROM service_contracts sc
       LEFT JOIN service_contracts prior
         ON prior.customer_id = sc.customer_id
        AND EXTRACT(YEAR FROM prior.season_start_date) = $2 - 1
        AND prior.service_tier = sc.service_tier
        AND prior.deleted_at IS NULL
       WHERE sc.tenant_id = $1
         AND EXTRACT(YEAR FROM sc.season_start_date) = $2
         AND sc.deleted_at IS NULL
       GROUP BY sc.service_tier
     )
     SELECT
       t.tier,
       COALESCE(ac.count, '0')               AS active_contracts,
       COALESCE(r.season_revenue, '0')       AS season_revenue,
       CASE
         WHEN COALESCE(ac.count::int, 0) > 0
         THEN ROUND(COALESCE(r.season_revenue::numeric, 0) / ac.count::numeric, 2)::text
         ELSE '0'
       END                                    AS avg_contract_value,
       COALESCE(occ.total_occurrences, '0')  AS total_occurrences,
       COALESCE(occ.skipped_visits, '0')     AS skipped_visits,
       CASE
         WHEN t.tier = 'bronze' THEN NULL
         WHEN COALESCE(occ.total_occurrences::int, 0) > 0
         THEN ROUND(occ.ok_occ::numeric / occ.total_occurrences::numeric * 100, 0)::text
         ELSE '0'
       END                                    AS service_completion_rate,
       COALESCE(ret.clients_retained_pct, '0') AS clients_retained_pct
     FROM (VALUES ('gold'), ('silver'), ('bronze')) AS t(tier)
     LEFT JOIN active_contracts ac ON ac.tier = t.tier
     LEFT JOIN revenue r           ON r.tier  = t.tier
     LEFT JOIN occurrences occ     ON occ.tier = t.tier
     LEFT JOIN retention ret       ON ret.tier = t.tier
     ORDER BY CASE t.tier WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 ELSE 3 END`,
    [tenantId, seasonYear],
  );

  return res.rows.map((r) => ({
    tier: r.tier,
    active_contracts: Number(r.active_contracts),
    season_revenue: Number(r.season_revenue),
    avg_contract_value: r.avg_contract_value ? Number(r.avg_contract_value) : 0,
    total_occurrences: Number(r.total_occurrences),
    skipped_visits: Number(r.skipped_visits),
    service_completion_rate:
      r.service_completion_rate === null ? null : Number(r.service_completion_rate),
    clients_retained_pct: r.clients_retained_pct ? Number(r.clients_retained_pct) : 0,
  }));
}
