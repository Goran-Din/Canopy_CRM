import { logger } from '../../../config/logger.js';
import { queryDb } from '../../../config/database.js';

/**
 * Retrieve the OnlineInvoiceUrl from Xero for an invoice.
 * NEVER blocks or rolls back invoice push — failures are logged and retried.
 */
export async function retrievePaymentUrl(
  tenantId: string,
  xeroInvoiceId: string,
  crmInvoiceId: string,
): Promise<string | null> {
  try {
    const { xeroRequest } = await import('./xero-client.js');
    const response = await xeroRequest(
      tenantId, 'GET', `/Invoices/${xeroInvoiceId}?unitdp=4`, null,
    );

    const invoice = response?.Invoices?.[0];
    const onlineUrl = invoice?.OnlineInvoiceUrl as string | undefined;

    if (onlineUrl) {
      await queryDb(
        `UPDATE invoices SET xero_payment_url = $1, xero_payment_url_retrieved_at = NOW()
         WHERE id = $2`,
        [onlineUrl, crmInvoiceId],
      );
      await logPaymentUrlEvent(tenantId, xeroInvoiceId, 'invoice.payment_url.retrieved', 'success');
      return onlineUrl;
    }

    // URL is null — Stripe may not be connected
    await logPaymentUrlEvent(
      tenantId, xeroInvoiceId,
      'invoice.payment_url.missing', 'failed',
      'OnlineInvoiceUrl is null — Stripe may not be connected to Xero',
    );
    return null;
  } catch (err) {
    await logPaymentUrlEvent(
      tenantId, xeroInvoiceId,
      'invoice.payment_url.error', 'failed',
      (err as Error).message,
    );
    return null; // NEVER throw — don't roll back invoice push
  }
}

/**
 * Find invoices missing payment URLs for retry.
 */
export async function findMissingPaymentUrls(tenantId: string) {
  const result = await queryDb<Record<string, unknown>>(
    `SELECT id, xero_invoice_id FROM invoices
     WHERE tenant_id = $1
       AND xero_payment_url IS NULL
       AND xero_invoice_id IS NOT NULL
       AND status = 'awaiting_payment'
       AND created_at > NOW() - INTERVAL '7 days'`,
    [tenantId],
  );
  return result.rows;
}

async function logPaymentUrlEvent(
  tenantId: string,
  xeroInvoiceId: string,
  eventType: string,
  status: string,
  errorMessage?: string,
) {
  try {
    await queryDb(
      `INSERT INTO integration_sync_log
       (tenant_id, provider, direction, entity_type, external_id, status, error_message)
       VALUES ($1, 'xero', 'inbound', $2, $3, $4, $5)`,
      [tenantId, eventType, xeroInvoiceId, status, errorMessage ?? null],
    );
  } catch {
    logger.error('Failed to log payment URL event');
  }
}
