import { queryDb } from '../../config/database.js';

export interface CommandCenterSummaryRow {
  crews_active: string;
  crews_not_in: string;
  billing_drafts_amount: string;
  billing_drafts_count: string;
  billing_overdue_amount: string;
  billing_overdue_count: string;
  season_completion_pct: string;
  season_pending_count: string;
  feedback_avg_rating: string;
  feedback_response_count: string;
  jobs_today_total: string;
  jobs_today_completed: string;
  jobs_today_active: string;
  jobs_today_scheduled: string;
  jobs_today_unassigned: string;
}

export async function getCommandCenterSummary(tenantId: string): Promise<CommandCenterSummaryRow> {
  const result = await queryDb<CommandCenterSummaryRow>(
    `WITH crew_status AS (
       SELECT
         COUNT(DISTINCT CASE WHEN te.clock_in IS NOT NULL AND te.clock_out IS NULL THEN te.crew_id END) AS crews_active,
         COUNT(DISTINCT CASE
           WHEN c.id IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM time_entries te2
               WHERE te2.crew_id = c.id
                 AND te2.clock_in::date = CURRENT_DATE
                 AND te2.tenant_id = $1
                 AND te2.deleted_at IS NULL
             )
           THEN c.id END) AS crews_not_in
       FROM crews c
       LEFT JOIN time_entries te ON te.crew_id = c.id
         AND te.clock_in::date = CURRENT_DATE
         AND te.tenant_id = $1
         AND te.deleted_at IS NULL
       WHERE c.tenant_id = $1
         AND c.deleted_at IS NULL
         AND c.is_active = true
     ),
     billing_status AS (
       SELECT
         COALESCE(SUM(CASE WHEN i.status = 'draft' THEN i.total::numeric ELSE 0 END), 0) AS drafts_amount,
         COUNT(CASE WHEN i.status = 'draft' THEN 1 END) AS drafts_count,
         COALESCE(SUM(CASE WHEN i.status = 'overdue' THEN i.balance_due::numeric ELSE 0 END), 0) AS overdue_amount,
         COUNT(CASE WHEN i.status = 'overdue' THEN 1 END) AS overdue_count
       FROM invoices i
       WHERE i.tenant_id = $1 AND i.deleted_at IS NULL
     ),
     season_status AS (
       SELECT
         COALESCE(ROUND(
           COUNT(CASE WHEN so.status = 'completed' THEN 1 END)::numeric /
           NULLIF(COUNT(*)::numeric, 0) * 100, 1
         ), 0) AS completion_pct,
         COUNT(CASE WHEN so.status = 'pending' THEN 1 END) AS pending_count
       FROM service_occurrences so
       WHERE so.tenant_id = $1
         AND so.season_year = EXTRACT(YEAR FROM CURRENT_DATE)::integer
         AND so.deleted_at IS NULL
     ),
     feedback_status AS (
       SELECT
         COALESCE(ROUND(AVG(f.rating)::numeric, 1), 0) AS avg_rating,
         COUNT(*) AS response_count
       FROM feedback_responses f
       WHERE f.tenant_id = $1
         AND f.created_at >= DATE_TRUNC('month', CURRENT_DATE)
         AND f.deleted_at IS NULL
     ),
     jobs_today AS (
       SELECT
         COUNT(*) AS total,
         COUNT(CASE WHEN j.status = 'completed' THEN 1 END) AS completed,
         COUNT(CASE WHEN j.status IN ('in_progress', 'arrived') THEN 1 END) AS active,
         COUNT(CASE WHEN j.status = 'scheduled' THEN 1 END) AS scheduled,
         COUNT(CASE WHEN j.assigned_crew_id IS NULL THEN 1 END) AS unassigned
       FROM jobs j
       WHERE j.tenant_id = $1
         AND j.scheduled_date = CURRENT_DATE
         AND j.deleted_at IS NULL
         AND j.status != 'cancelled'
     )
     SELECT
       cs.crews_active, cs.crews_not_in,
       bs.drafts_amount AS billing_drafts_amount, bs.drafts_count AS billing_drafts_count,
       bs.overdue_amount AS billing_overdue_amount, bs.overdue_count AS billing_overdue_count,
       ss.completion_pct AS season_completion_pct, ss.pending_count AS season_pending_count,
       fs.avg_rating AS feedback_avg_rating, fs.response_count AS feedback_response_count,
       jt.total AS jobs_today_total, jt.completed AS jobs_today_completed,
       jt.active AS jobs_today_active, jt.scheduled AS jobs_today_scheduled,
       jt.unassigned AS jobs_today_unassigned
     FROM crew_status cs, billing_status bs, season_status ss, feedback_status fs, jobs_today jt`,
    [tenantId],
  );
  return result.rows[0];
}
