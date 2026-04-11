import { runExpiryNightlyCron } from '../service.js';

/**
 * Nightly feedback expiry cron job.
 * Runs at 01:00 UTC daily.
 * Sets status='expired' for feedback links older than 14 days that haven't been responded to.
 *
 * Setup in index.ts:
 *   import cron from 'node-cron';
 *   import { runFeedbackExpiryCron } from './modules/feedback/cron/feedback-expiry.js';
 *   cron.schedule('0 1 * * *', runFeedbackExpiryCron);
 */
export async function runFeedbackExpiryCron() {
  await runExpiryNightlyCron();
}
