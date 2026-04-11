import * as repo from './repository.js';

export async function getCommandCenterSummary(tenantId: string) {
  const row = await repo.getCommandCenterSummary(tenantId);
  return {
    crews_active: parseInt(row.crews_active) || 0,
    crews_not_in: parseInt(row.crews_not_in) || 0,
    billing_drafts_amount: parseFloat(row.billing_drafts_amount) || 0,
    billing_drafts_count: parseInt(row.billing_drafts_count) || 0,
    billing_overdue_amount: parseFloat(row.billing_overdue_amount) || 0,
    billing_overdue_count: parseInt(row.billing_overdue_count) || 0,
    season_completion_pct: parseFloat(row.season_completion_pct) || 0,
    season_pending_count: parseInt(row.season_pending_count) || 0,
    feedback_avg_rating: parseFloat(row.feedback_avg_rating) || 0,
    feedback_response_count: parseInt(row.feedback_response_count) || 0,
    jobs_today_total: parseInt(row.jobs_today_total) || 0,
    jobs_today_completed: parseInt(row.jobs_today_completed) || 0,
    jobs_today_active: parseInt(row.jobs_today_active) || 0,
    jobs_today_scheduled: parseInt(row.jobs_today_scheduled) || 0,
    jobs_today_unassigned: parseInt(row.jobs_today_unassigned) || 0,
  };
}
