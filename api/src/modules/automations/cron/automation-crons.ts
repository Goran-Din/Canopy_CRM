import { logger } from '../../../config/logger.js';
import { queryDb } from '../../../config/database.js';
import { fireAutomation } from '../service.js';

/**
 * Appointment Reminder — runs daily at 8:00 AM.
 * Finds jobs scheduled for tomorrow with status='scheduled'.
 *
 * Setup in index.ts:
 *   import cron from 'node-cron';
 *   import { runAppointmentReminderCron, runQuoteFollowUpCron, runPaymentReminderCron } from './modules/automations/cron/automation-crons.js';
 *   cron.schedule('0 8 * * *', runAppointmentReminderCron);
 *   cron.schedule('0 9 * * *', runQuoteFollowUpCron);
 *   cron.schedule('0 10 * * *', runPaymentReminderCron);
 */
export async function runAppointmentReminderCron() {
  logger.info('Running appointment reminder cron');

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const result = await queryDb<Record<string, unknown>>(
      `SELECT j.id AS job_id, j.tenant_id, j.customer_id, j.property_id, j.scheduled_date
       FROM jobs j
       WHERE j.status = 'scheduled'
         AND j.scheduled_date::date = $1
         AND j.deleted_at IS NULL`,
      [tomorrowStr],
    );

    let sent = 0;
    for (const job of result.rows) {
      try {
        await fireAutomation(job.tenant_id as string, 'appointment_reminder', {
          job_id: job.job_id as string,
          customer_id: job.customer_id as string,
          property_id: job.property_id as string,
          scheduled_date: job.scheduled_date as string,
        });
        sent++;
      } catch (err) {
        logger.error('Appointment reminder failed', {
          job_id: job.job_id,
          error: (err as Error).message,
        });
      }
    }

    logger.info('Appointment reminder cron complete', { sent, total: result.rows.length });
  } catch (err) {
    logger.error('Appointment reminder cron failed', { error: (err as Error).message });
  }
}

/**
 * Quote Follow-Up — runs daily at 9:00 AM.
 * Finds quotes with status='sent' where sent_at exceeds delay (default 5 days).
 * Skips if quote is now signed or expired.
 */
export async function runQuoteFollowUpCron() {
  logger.info('Running quote follow-up cron');

  try {
    // Get all tenants with enabled quote_followup config
    const configs = await queryDb<Record<string, unknown>>(
      `SELECT tenant_id, delay_minutes FROM automation_configs
       WHERE automation_type = 'quote_followup' AND is_enabled = TRUE`,
    );

    let sent = 0;
    for (const config of configs.rows) {
      const delayMinutes = Number(config.delay_minutes ?? 7200); // default 5 days = 7200 min
      const delayInterval = `${delayMinutes} minutes`;

      const quotes = await queryDb<Record<string, unknown>>(
        `SELECT q.id AS quote_id, q.tenant_id, q.job_id, j.customer_id,
                q.signing_token
         FROM quotes_v2 q
         JOIN jobs j ON j.id = q.job_id
         WHERE q.tenant_id = $1
           AND q.status = 'sent'
           AND q.sent_at < NOW() - $2::interval`,
        [config.tenant_id, delayInterval],
      );

      for (const quote of quotes.rows) {
        try {
          await fireAutomation(quote.tenant_id as string, 'quote_followup', {
            quote_id: quote.quote_id as string,
            job_id: quote.job_id as string,
            customer_id: quote.customer_id as string,
            signing_link: `/sign/${quote.signing_token}`,
          });
          sent++;
        } catch (err) {
          logger.error('Quote follow-up failed', {
            quote_id: quote.quote_id,
            error: (err as Error).message,
          });
        }
      }
    }

    logger.info('Quote follow-up cron complete', { sent });
  } catch (err) {
    logger.error('Quote follow-up cron failed', { error: (err as Error).message });
  }
}

/**
 * Payment Reminder — runs daily at 10:00 AM.
 * Finds invoices where status='sent' AND due_date < TODAY.
 * Respects max_repeats and repeat_interval_days.
 */
export async function runPaymentReminderCron() {
  logger.info('Running payment reminder cron');

  try {
    const configs = await queryDb<Record<string, unknown>>(
      `SELECT tenant_id, max_repeats, repeat_interval_days FROM automation_configs
       WHERE automation_type = 'payment_reminder' AND is_enabled = TRUE`,
    );

    let sent = 0;
    for (const config of configs.rows) {
      const repeatIntervalDays = Number(config.repeat_interval_days ?? 7);

      const invoices = await queryDb<Record<string, unknown>>(
        `SELECT i.id AS invoice_id, i.tenant_id, i.customer_id,
                i.total_amount, i.due_date,
                EXTRACT(DAY FROM NOW() - i.due_date)::int AS days_overdue
         FROM invoices i
         WHERE i.tenant_id = $1
           AND i.status = 'sent'
           AND i.due_date < CURRENT_DATE
           AND i.deleted_at IS NULL`,
        [config.tenant_id],
      );

      for (const inv of invoices.rows) {
        try {
          // Check if last reminder was sent within repeat_interval_days
          const lastSent = await queryDb<Record<string, unknown>>(
            `SELECT sent_at FROM automation_log
             WHERE tenant_id = $1 AND automation_type = 'payment_reminder'
               AND invoice_id = $2 AND status = 'sent'
             ORDER BY sent_at DESC LIMIT 1`,
            [config.tenant_id, inv.invoice_id],
          );

          if (lastSent.rows.length > 0) {
            const lastDate = new Date(lastSent.rows[0].sent_at as string);
            const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (24 * 60 * 60 * 1000));
            if (daysSince < repeatIntervalDays) continue;
          }

          await fireAutomation(inv.tenant_id as string, 'payment_reminder', {
            invoice_id: inv.invoice_id as string,
            customer_id: inv.customer_id as string,
            amount: Number(inv.total_amount),
            due_date: inv.due_date as string,
            days_overdue: inv.days_overdue as number,
          });
          sent++;
        } catch (err) {
          logger.error('Payment reminder failed', {
            invoice_id: inv.invoice_id,
            error: (err as Error).message,
          });
        }
      }
    }

    logger.info('Payment reminder cron complete', { sent });
  } catch (err) {
    logger.error('Payment reminder cron failed', { error: (err as Error).message });
  }
}
