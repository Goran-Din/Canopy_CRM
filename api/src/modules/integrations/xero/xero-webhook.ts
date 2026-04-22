import crypto from 'node:crypto';
import { logger } from '../../../config/logger.js';
import { queryDb } from '../../../config/database.js';
import type { Request, Response } from 'express';

/**
 * Verify HMAC-SHA256 signature from Xero webhook.
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const key = process.env.XERO_WEBHOOK_KEY || '';
  if (!key) return false;
  const expected = crypto
    .createHmac('sha256', key)
    .update(payload)
    .digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Handle Xero webhook events.
 * Returns 200 immediately — processing is async.
 */
export async function handleWebhook(req: Request, res: Response) {
  const signature = req.headers['x-xero-signature'] as string;
  const rawBody = JSON.stringify(req.body);

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    res.status(401).json({ status: 'error', message: 'Invalid signature' });
    return;
  }

  // Return 200 immediately
  res.status(200).json({ status: 'received' });

  // Process events asynchronously
  const events = req.body?.events || [];
  for (const event of events) {
    try {
      switch (event.eventType) {
        case 'PAID':
          await handleXeroPaid(
            event.resourceId,
            event.amountPaid,
            event.fullyPaidDate,
          );
          break;
        case 'AUTHORISED':
        case 'VOIDED':
          logger.info('Xero webhook event received', { eventType: event.eventType, resourceId: event.resourceId });
          break;
        default:
          logger.info('Unhandled Xero webhook event', { eventType: event.eventType });
      }
    } catch (err) {
      logger.error('Xero webhook event processing failed', {
        eventType: event.eventType,
        error: (err as Error).message,
      });
    }
  }
}

/**
 * Handle invoice PAID event from Xero.
 */
async function handleXeroPaid(
  xeroInvoiceId: string,
  amountPaid: number | undefined,
  fullyPaidDate: string | undefined,
) {
  // Find CRM invoice by xero_invoice_id
  const invoiceResult = await queryDb<Record<string, unknown>>(
    `SELECT i.*, j.id AS job_id FROM invoices i
     LEFT JOIN jobs j ON j.id = i.job_id
     WHERE i.xero_invoice_id = $1`,
    [xeroInvoiceId],
  );

  const invoice = invoiceResult.rows[0];
  if (!invoice) {
    // Not tracked in CRM — log as ignored
    logger.info('Xero PAID webhook for unknown invoice', { xero_invoice_id: xeroInvoiceId });
    await logSyncEvent(null, 'invoice.PAID', 'skipped', xeroInvoiceId, 'Invoice not found in CRM');
    return;
  }

  const tenantId = invoice.tenant_id as string;
  const invoiceId = invoice.id as string;
  const jobId = invoice.job_id as string | null;
  const invoiceNumber = invoice.invoice_number as string;
  const paidDate = fullyPaidDate ?? new Date().toISOString().split('T')[0];

  // Update invoice status
  await queryDb(
    `UPDATE invoices SET status = 'paid', paid_at = $1, amount_paid = $2
     WHERE id = $3`,
    [paidDate, amountPaid ?? invoice.total_amount, invoiceId],
  );

  // Update billing schedule if linked
  if (invoice.billing_schedule_id) {
    await queryDb(
      `UPDATE billing_schedule SET status = 'paid' WHERE id = $1`,
      [invoice.billing_schedule_id],
    );
  }

  // Update milestone if linked
  if (invoice.milestone_id) {
    await queryDb(
      `UPDATE billing_milestones SET status = 'paid', paid_at = $1 WHERE id = $2`,
      [paidDate, invoice.milestone_id],
    );
  }

  // Job diary entry
  if (jobId) {
    try {
      await queryDb(
        `INSERT INTO job_diary_entries
         (tenant_id, job_id, entry_type, title, metadata, is_system_entry)
         VALUES ($1, $2, 'invoice_paid', $3, $4, TRUE)`,
        [
          tenantId,
          jobId,
          `Invoice ${invoiceNumber} paid — $${amountPaid ?? 0} on ${paidDate}`,
          JSON.stringify({ invoice_id: invoiceId, amount_paid: amountPaid, paid_date: paidDate }),
        ],
      );
    } catch {
      // Diary entry failure is non-fatal
    }
  }

  // Log success
  await logSyncEvent(tenantId, 'invoice.PAID', 'success', xeroInvoiceId);

  // Post-transaction async work
  try {
    // Cancel payment reminders
    await queryDb(
      `UPDATE automation_log SET status = 'cancelled'
       WHERE invoice_id = $1 AND automation_type = 'payment_reminder'
         AND status = 'sent'`,
      [invoiceId],
    );

    // Schedule feedback request
    const { handleInvoicePaid } = await import('../../automations/service.js');
    await handleInvoicePaid(tenantId, invoiceId);
  } catch (err) {
    logger.error('Post-payment automation failed', { error: (err as Error).message });
  }
}

async function logSyncEvent(
  tenantId: string | null,
  eventType: string,
  status: string,
  externalId: string,
  errorMessage?: string,
) {
  try {
    await queryDb(
      `INSERT INTO integration_sync_log
       (tenant_id, provider, direction, entity_type, entity_id, external_id, status, error_message)
       VALUES ($1, 'xero', 'inbound', $2, NULL, $3, $4, $5)`,
      [tenantId, eventType, externalId, status, errorMessage ?? null],
    );
  } catch {
    // Logging failure should not propagate
  }
}
