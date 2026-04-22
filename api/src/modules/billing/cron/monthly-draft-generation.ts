import { logger } from '../../../config/logger.js';
// NOTE: generateMonthlyDrafts is not called here yet — this cron is a
// documented placeholder (see the log line below). Real tenant iteration
// and multi-tenant draft generation will land in a later brief. Import
// restored when the placeholder is replaced.

/**
 * Monthly draft generation cron job.
 * Runs at 06:00 UTC on the 1st of every month.
 *
 * Setup in server.ts:
 *   import cron from 'node-cron';
 *   import { runMonthlyDraftGeneration } from './modules/billing/cron/monthly-draft-generation.js';
 *   cron.schedule('0 6 1 * *', runMonthlyDraftGeneration);
 */
export async function runMonthlyDraftGeneration() {
  const billingDate = new Date().toISOString().split('T')[0];
  logger.info('Starting monthly draft generation', { billingDate });

  try {
    // In multi-tenant mode, iterate all active tenants.
    // For now this is a placeholder — actual tenant iteration
    // would come from a tenants table query.
    logger.info('Monthly draft generation placeholder — trigger via POST /v1/billing/generate-drafts');
  } catch (err) {
    logger.error('Monthly draft generation failed', { error: (err as Error).message });
  }
}
