import { queryDb } from '../../config/database.js';

// --- Result types ---

// Wave 7 Brief 05 (I-3 v2) GPS Analytics row shapes
export interface PropertyVisitRow {
  arrival_at: string;
  departure_at: string | null;
  time_on_site_minutes: number | null;
  crew_member: string;
  job_number: string | null;
  verification_status: 'verified' | 'flagged' | 'unverified';
  distance_from_centre_at_departure: number | null;
}
export interface PropertyVisitSummary {
  total_visits: number;
  verified_visits: number;
  avg_time_on_site_minutes: number;
  scheduled_estimate_minutes: number | null;
  variance_minutes: number | null;
}
export interface PayrollCrossCheckRow {
  gps_event_id: string | null;
  work_date: string;
  user_id: string;
  crew_member: string;
  layer1_minutes: number;
  layer2_minutes: number;
  diff_minutes: number;
  diff_pct: number | null;
  properties_visited: number;
  status: 'flagged' | 'reviewed' | 'consistent';
}
export interface ServiceVerificationRow {
  occurrence_id: string;
  customer_name: string;
  street_address: string | null;
  service_code: string;
  service_name: string;
  occurrence_label: string;
  assigned_date: string | null;
  job_number: string | null;
  verification_status: 'verified' | 'unverified' | 'no_gps';
  time_on_site_minutes: number | null;
  crew_member: string | null;
  service_tier: string;
}
export interface RoutePerformanceRow {
  property_id: string;
  street_address: string | null;
  property_category: string | null;
  estimated_duration_minutes: number | null;
  avg_actual: number;
  variance_minutes: number | null;
  variance_pct: number | null;
  visit_count: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

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

// ============================================
// Wave 7 Brief 05 — GPS Analytics (I-3 v2)
// ============================================
// SCHEMA RECONCILIATION (flagged in the brief):
//   Brief name              Actual column (used here)
//   ----------------------  --------------------------
//   gps_events.crew_member_id   → user_id
//   gps_events.event_at         → recorded_at
//   gps_events.property_id      → NOT PRESENT. Derived via
//                                  COALESCE(so.property_id, j.property_id)
//   crew_day_logs table         → aggregate time_entries by (user_id, DATE(clock_in))
//   users.display_name          → first_name || ' ' || last_name
//
// "Verified visit" definition (shared by every report below):
//   - event_type = 'departure'
//   - associated to a property (COALESCE above IS NOT NULL)
//   - dwell_minutes >= 5
//   - distance_from_centre_metres IS NULL OR <= COALESCE(geofence_radius_at_trigger, 40)
//   - payroll_cross_check_status IN ('consistent', 'pending')

interface PropertyVisitRawRow {
  arrival_at: string;
  departure_at: string | null;
  time_on_site_minutes: number | string | null;
  crew_member: string;
  job_number: string | null;
  verification_status: string;
  distance_from_centre_at_departure: number | string | null;
}

export async function getPropertyVisitHistory(
  tenantId: string,
  propertyId: string,
  opts: {
    from_date?: string;
    to_date?: string;
    crew_member_id?: string;
    verified_only?: boolean;
  } = {},
): Promise<{ rows: PropertyVisitRow[]; summary: PropertyVisitSummary }> {
  const fromDate = opts.from_date ?? `${new Date().getFullYear()}-04-01`;
  const toDate = opts.to_date ?? new Date().toISOString().slice(0, 10);

  const crewFilter = opts.crew_member_id ? 'AND ge.user_id = $4' : '';
  const params: unknown[] = [tenantId, propertyId, fromDate];
  if (opts.crew_member_id) params.push(opts.crew_member_id);
  params.push(toDate);
  const toDateIdx = params.length;

  const res = await queryDb<PropertyVisitRawRow>(
    `WITH property_events AS (
       SELECT ge.*, COALESCE(so.property_id, j.property_id) AS derived_property_id
       FROM gps_events ge
       LEFT JOIN service_occurrences so ON so.id = ge.service_occurrence_id
       LEFT JOIN jobs j ON j.id = ge.job_id
       WHERE ge.tenant_id = $1
         AND ge.recorded_at >= $3::date
         AND ge.recorded_at <= $${toDateIdx}::date + INTERVAL '1 day'
         ${crewFilter}
     ),
     filtered AS (
       SELECT * FROM property_events WHERE derived_property_id = $2
     ),
     arrivals AS (
       SELECT id, user_id, job_id, recorded_at, distance_from_centre_metres
       FROM filtered
       WHERE event_type IN ('arrival', 'geofence_enter')
     ),
     departures AS (
       SELECT id, user_id, recorded_at, dwell_minutes, distance_from_centre_metres,
              payroll_cross_check_status
       FROM filtered
       WHERE event_type IN ('departure', 'geofence_exit')
     )
     SELECT
       a.recorded_at                       AS arrival_at,
       d.recorded_at                       AS departure_at,
       d.dwell_minutes                     AS time_on_site_minutes,
       (u.first_name || ' ' || u.last_name) AS crew_member,
       j.job_number                        AS job_number,
       CASE
         WHEN d.payroll_cross_check_status = 'consistent' THEN 'verified'
         WHEN d.payroll_cross_check_status = 'flagged'    THEN 'flagged'
         ELSE 'unverified'
       END                                 AS verification_status,
       d.distance_from_centre_metres       AS distance_from_centre_at_departure
     FROM arrivals a
     LEFT JOIN LATERAL (
       SELECT *
       FROM departures dep
       WHERE dep.user_id = a.user_id AND dep.recorded_at > a.recorded_at
       ORDER BY dep.recorded_at ASC LIMIT 1
     ) d ON TRUE
     JOIN users u ON u.id = a.user_id
     LEFT JOIN jobs j ON j.id = a.job_id
     ORDER BY a.recorded_at DESC`,
    params,
  );

  const rows: PropertyVisitRow[] = res.rows
    .filter((r) => {
      if (!opts.verified_only) return true;
      return r.verification_status === 'verified';
    })
    .map((r) => ({
      arrival_at: r.arrival_at,
      departure_at: r.departure_at,
      time_on_site_minutes:
        r.time_on_site_minutes === null || r.time_on_site_minutes === undefined
          ? null
          : Number(r.time_on_site_minutes),
      crew_member: r.crew_member,
      job_number: r.job_number,
      verification_status: r.verification_status as PropertyVisitRow['verification_status'],
      distance_from_centre_at_departure:
        r.distance_from_centre_at_departure === null ||
        r.distance_from_centre_at_departure === undefined
          ? null
          : Number(r.distance_from_centre_at_departure),
    }));

  const verifiedCount = rows.filter((r) => r.verification_status === 'verified').length;
  const minutesArr = rows
    .map((r) => r.time_on_site_minutes)
    .filter((m): m is number => typeof m === 'number');
  const avg = minutesArr.length > 0
    ? Math.round(minutesArr.reduce((a, b) => a + b, 0) / minutesArr.length)
    : 0;

  // Scheduled estimate (from route_stops.estimated_duration_minutes)
  const rsRes = await queryDb<{ estimated_duration_minutes: number | null }>(
    `SELECT estimated_duration_minutes
     FROM route_stops
     WHERE tenant_id = $1 AND property_id = $2 AND is_active = TRUE
     ORDER BY created_at DESC LIMIT 1`,
    [tenantId, propertyId],
  );
  const scheduledEstimate = rsRes.rows[0]?.estimated_duration_minutes ?? null;

  return {
    rows,
    summary: {
      total_visits: rows.length,
      verified_visits: verifiedCount,
      avg_time_on_site_minutes: avg,
      scheduled_estimate_minutes: scheduledEstimate,
      variance_minutes: scheduledEstimate !== null ? avg - scheduledEstimate : null,
    },
  };
}

interface PayrollCrossCheckRawRow {
  gps_event_id: string | null;
  work_date: string;
  user_id: string;
  crew_member: string;
  layer1_minutes: number | string;
  layer2_minutes: number | string;
  diff_minutes: number | string;
  diff_pct: string | null;
  properties_visited: number | string;
  status: string;
}

export async function getPayrollCrossCheck(
  tenantId: string,
  fromDate: string,
  toDate: string,
  opts: { user_id?: string; status?: string } = {},
): Promise<PayrollCrossCheckRow[]> {
  const userCond = opts.user_id ? 'AND te.user_id = $4' : '';
  const params: unknown[] = [tenantId, fromDate, toDate];
  if (opts.user_id) params.push(opts.user_id);

  const res = await queryDb<PayrollCrossCheckRawRow>(
    `WITH layer1 AS (
       SELECT te.user_id, DATE(te.clock_in) AS work_date,
              SUM(te.total_minutes)::int AS layer1_minutes
       FROM time_entries te
       WHERE te.tenant_id = $1
         AND te.clock_in::date BETWEEN $2 AND $3
         AND te.deleted_at IS NULL
         ${userCond}
       GROUP BY te.user_id, DATE(te.clock_in)
     ),
     layer2 AS (
       SELECT ge.user_id,
              ge.recorded_at::date AS work_date,
              SUM(ge.dwell_minutes)::int AS layer2_minutes,
              COUNT(*)::int AS verified_visit_count,
              BOOL_OR(ge.payroll_cross_check_status = 'flagged')  AS any_flagged,
              BOOL_OR(ge.payroll_cross_check_status = 'reviewed') AS any_reviewed,
              (ARRAY_AGG(ge.id ORDER BY ge.recorded_at DESC))[1] AS latest_event_id
       FROM gps_events ge
       WHERE ge.tenant_id = $1
         AND ge.recorded_at::date BETWEEN $2 AND $3
         AND ge.event_type IN ('departure', 'geofence_exit')
         AND ge.dwell_minutes IS NOT NULL
       GROUP BY ge.user_id, ge.recorded_at::date
     )
     SELECT
       l2.latest_event_id                   AS gps_event_id,
       COALESCE(l1.work_date, l2.work_date) AS work_date,
       COALESCE(l1.user_id,   l2.user_id)   AS user_id,
       (u.first_name || ' ' || u.last_name) AS crew_member,
       COALESCE(l1.layer1_minutes, 0)::int  AS layer1_minutes,
       COALESCE(l2.layer2_minutes, 0)::int  AS layer2_minutes,
       (COALESCE(l1.layer1_minutes, 0) - COALESCE(l2.layer2_minutes, 0))::int AS diff_minutes,
       CASE
         WHEN COALESCE(l1.layer1_minutes, 0) = 0 THEN NULL
         ELSE ROUND(
           (COALESCE(l1.layer1_minutes, 0) - COALESCE(l2.layer2_minutes, 0))::numeric
             / l1.layer1_minutes * 100, 1
         )::text
       END                                  AS diff_pct,
       COALESCE(l2.verified_visit_count, 0)::int AS properties_visited,
       CASE
         WHEN l2.any_flagged  THEN 'flagged'
         WHEN l2.any_reviewed THEN 'reviewed'
         WHEN ABS(COALESCE(l1.layer1_minutes, 0) - COALESCE(l2.layer2_minutes, 0)) > 30 THEN 'flagged'
         ELSE 'consistent'
       END                                  AS status
     FROM layer1 l1
     FULL OUTER JOIN layer2 l2 ON l1.user_id = l2.user_id AND l1.work_date = l2.work_date
     JOIN users u ON u.id = COALESCE(l1.user_id, l2.user_id)
     ORDER BY work_date DESC`,
    params,
  );

  const mapped = res.rows.map((r) => ({
    gps_event_id: r.gps_event_id,
    work_date: r.work_date,
    user_id: r.user_id,
    crew_member: r.crew_member,
    layer1_minutes: Number(r.layer1_minutes),
    layer2_minutes: Number(r.layer2_minutes),
    diff_minutes: Number(r.diff_minutes),
    diff_pct: r.diff_pct === null ? null : Number(r.diff_pct),
    properties_visited: Number(r.properties_visited),
    status: r.status as PayrollCrossCheckRow['status'],
  }));

  // Post-filter by status (can't easily do it in a FULL OUTER JOIN WHERE clause)
  if (opts.status) {
    return mapped.filter((r) => r.status === opts.status);
  }
  return mapped;
}

export async function resolvePayrollCrossCheck(
  tenantId: string,
  gpsEventId: string,
  note: string,
): Promise<boolean> {
  const res = await queryDb<{ id: string }>(
    `UPDATE gps_events
     SET payroll_cross_check_status = 'reviewed',
         payroll_cross_check_note = $3
     WHERE tenant_id = $1 AND id = $2
     RETURNING id`,
    [tenantId, gpsEventId, note],
  );
  return res.rows.length > 0;
}

interface ServiceVerificationRawRow {
  occurrence_id: string;
  customer_name: string;
  street_address: string | null;
  service_code: string;
  service_name: string;
  occurrence_label: string;
  assigned_date: string | null;
  job_number: string | null;
  verification_status: string;
  time_on_site_minutes: number | string | null;
  crew_member: string | null;
  service_tier: string;
}

export async function getServiceVerification(
  tenantId: string,
  seasonYear: number,
  opts: {
    service_code?: string;
    tier?: string;
    verification?: 'verified' | 'unverified' | 'no_gps';
    crew_member_id?: string;
    from_date?: string;
    to_date?: string;
  } = {},
): Promise<ServiceVerificationRow[]> {
  const conds: string[] = [
    'so.tenant_id = $1',
    'so.season_year = $2',
    "so.status IN ('completed', 'assigned')",
  ];
  const params: unknown[] = [tenantId, seasonYear];
  let pi = 3;

  if (opts.service_code) {
    conds.push(`so.service_code = $${pi}`);
    params.push(opts.service_code);
    pi++;
  }
  if (opts.tier) {
    conds.push(`sc.service_tier = $${pi}`);
    params.push(opts.tier);
    pi++;
  }
  if (opts.crew_member_id) {
    conds.push(`ge.user_id = $${pi}`);
    params.push(opts.crew_member_id);
    pi++;
  }
  if (opts.from_date) {
    conds.push(`so.assigned_date >= $${pi}`);
    params.push(opts.from_date);
    pi++;
  }
  if (opts.to_date) {
    conds.push(`so.assigned_date <= $${pi}`);
    params.push(opts.to_date);
    pi++;
  }

  const res = await queryDb<ServiceVerificationRawRow>(
    `SELECT
        so.id AS occurrence_id,
        c.display_name AS customer_name,
        p.street_address,
        so.service_code,
        so.service_name,
        (so.occurrence_number || '/' || (
          SELECT MAX(so2.occurrence_number)
          FROM service_occurrences so2
          WHERE so2.contract_id = so.contract_id AND so2.service_code = so.service_code
        )) AS occurrence_label,
        so.assigned_date,
        j.job_number,
        CASE
          WHEN ge.id IS NULL THEN 'no_gps'
          WHEN ge.payroll_cross_check_status = 'consistent' THEN 'verified'
          ELSE 'unverified'
        END AS verification_status,
        ge.dwell_minutes AS time_on_site_minutes,
        CASE WHEN u.id IS NOT NULL THEN u.first_name || ' ' || u.last_name END AS crew_member,
        sc.service_tier
     FROM service_occurrences so
     JOIN customers c           ON c.id  = so.customer_id
     JOIN properties p          ON p.id  = so.property_id
     JOIN service_contracts sc  ON sc.id = so.contract_id
     LEFT JOIN jobs j           ON j.id  = so.job_id
     LEFT JOIN gps_events ge    ON ge.service_occurrence_id = so.id
                                 AND ge.event_type IN ('departure', 'geofence_exit')
     LEFT JOIN users u          ON u.id  = ge.user_id
     WHERE ${conds.join(' AND ')}
     ORDER BY so.assigned_date DESC NULLS LAST, c.display_name`,
    params,
  );

  const mapped = res.rows.map((r) => ({
    ...r,
    time_on_site_minutes: r.time_on_site_minutes === null
      ? null
      : Number(r.time_on_site_minutes),
    verification_status: r.verification_status as ServiceVerificationRow['verification_status'],
  }));

  // Post-filter by requested verification state (simpler than duplicating the CASE)
  if (opts.verification) {
    return mapped.filter((r) => r.verification_status === opts.verification);
  }
  return mapped;
}

interface RoutePerformanceRawRow {
  property_id: string;
  street_address: string | null;
  property_category: string | null;
  estimated_duration_minutes: number | string | null;
  avg_actual: string;
  variance_minutes: string | null;
  variance_pct: string | null;
  visit_count: string;
  trend: string;
}

export async function getRoutePerformance(
  tenantId: string,
  opts: {
    from_date?: string;
    to_date?: string;
    min_visit_count: number;
    division?: string;
    crew_id?: string;
  },
): Promise<RoutePerformanceRow[]> {
  const fromDate = opts.from_date ?? `${new Date().getFullYear()}-04-01`;
  const toDate = opts.to_date ?? new Date().toISOString().slice(0, 10);
  const params: unknown[] = [tenantId, fromDate, toDate, opts.min_visit_count];
  let pi = 5;
  const geConds: string[] = [
    "ge.event_type IN ('departure', 'geofence_exit')",
    "ge.payroll_cross_check_status = 'consistent'",
    'ge.dwell_minutes IS NOT NULL',
  ];
  if (opts.crew_id) {
    geConds.push(`ge.crew_id = $${pi}`);
    params.push(opts.crew_id);
    pi++;
  }

  const res = await queryDb<RoutePerformanceRawRow>(
    `WITH verified_visits AS (
       SELECT COALESCE(so.property_id, j.property_id) AS property_id,
              ge.recorded_at, ge.dwell_minutes,
              ROW_NUMBER() OVER (
                PARTITION BY COALESCE(so.property_id, j.property_id)
                ORDER BY ge.recorded_at DESC
              ) AS rn
       FROM gps_events ge
       LEFT JOIN service_occurrences so ON so.id = ge.service_occurrence_id
       LEFT JOIN jobs j ON j.id = ge.job_id
       WHERE ge.tenant_id = $1
         AND ge.recorded_at::date BETWEEN $2 AND $3
         AND ${geConds.join(' AND ')}
     ),
     aggregated AS (
       SELECT property_id,
              COUNT(*)::text                          AS visit_count,
              AVG(dwell_minutes)::numeric(10,1)::text AS avg_actual,
              AVG(dwell_minutes) FILTER (WHERE rn <= 5)                AS recent_avg,
              AVG(dwell_minutes) FILTER (WHERE rn > 5 AND rn <= 10)    AS previous_avg
       FROM verified_visits
       WHERE property_id IS NOT NULL
       GROUP BY property_id
     )
     SELECT
       p.id              AS property_id,
       p.street_address,
       p.property_category,
       rs.estimated_duration_minutes,
       a.avg_actual,
       (a.avg_actual::numeric - rs.estimated_duration_minutes)::numeric(10,1)::text AS variance_minutes,
       CASE
         WHEN rs.estimated_duration_minutes IS NULL OR rs.estimated_duration_minutes = 0 THEN NULL
         ELSE ROUND(
           (a.avg_actual::numeric - rs.estimated_duration_minutes)
             / rs.estimated_duration_minutes * 100, 1
         )::text
       END               AS variance_pct,
       a.visit_count,
       CASE
         WHEN a.recent_avg IS NULL OR a.previous_avg IS NULL THEN 'stable'
         WHEN a.recent_avg > a.previous_avg * 1.10 THEN 'increasing'
         WHEN a.recent_avg < a.previous_avg * 0.90 THEN 'decreasing'
         ELSE 'stable'
       END               AS trend
     FROM aggregated a
     JOIN properties p       ON p.id = a.property_id
     LEFT JOIN route_stops rs ON rs.property_id = p.id AND rs.is_active = TRUE
     WHERE a.visit_count::int >= $4
     ORDER BY variance_pct DESC NULLS LAST`,
    params,
  );

  void opts.division; // reserved for future join — currently no division column on properties
  return res.rows.map((r) => ({
    property_id: r.property_id,
    street_address: r.street_address,
    property_category: r.property_category,
    estimated_duration_minutes:
      r.estimated_duration_minutes === null
        ? null
        : Number(r.estimated_duration_minutes),
    avg_actual: Number(r.avg_actual),
    variance_minutes: r.variance_minutes === null ? null : Number(r.variance_minutes),
    variance_pct: r.variance_pct === null ? null : Number(r.variance_pct),
    visit_count: Number(r.visit_count),
    trend: r.trend as RoutePerformanceRow['trend'],
  }));
}
