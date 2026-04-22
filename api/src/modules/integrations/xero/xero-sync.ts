// ============================================
// Xero Sync Orchestrator
// ============================================

import { queryDb } from '../../../config/database.js';
import { AppError } from '../../../middleware/errorHandler.js';
import * as integrationService from '../service.js';
import * as repo from '../repository.js';
import * as xeroClient from './xero-client.js';
import * as xeroMapper from './xero-mapper.js';

// ======== Sync Customer ========

export async function syncCustomer(tenantId: string, customerId: string, _userId: string) {
  await integrationService.getActiveConfig(tenantId, 'xero');

  const custRes = await queryDb<Record<string, unknown>>(
    `SELECT * FROM customers WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [customerId, tenantId],
  );
  const customer = custRes.rows[0];
  if (!customer) throw new AppError(404, 'Customer not found');

  const log = await repo.createSyncLog(tenantId, 'xero', 'push', 'contact', customerId);
  const startTime = Date.now();

  try {
    const xeroContact = xeroMapper.mapCustomerToXeroContact(customer);
    const result = await xeroClient.pushContact(tenantId, xeroContact);

    // Store xero_contact_id on customer
    await queryDb(
      `UPDATE customers SET xero_contact_id = $1 WHERE id = $2 AND tenant_id = $3`,
      [result.ContactID, customerId, tenantId],
    );

    await repo.updateSyncLog(log.id, 'success', result.ContactID, null, xeroContact, result, Date.now() - startTime);
    return { xero_contact_id: result.ContactID };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await repo.updateSyncLog(log.id, 'failed', null, msg, null, null, Date.now() - startTime);
    throw new AppError(502, `Xero sync failed: ${msg}`);
  }
}

// ======== Sync Invoice ========

export async function syncInvoice(tenantId: string, invoiceId: string, _userId: string) {
  await integrationService.getActiveConfig(tenantId, 'xero');

  const invRes = await queryDb<Record<string, unknown>>(
    `SELECT i.*, c.xero_contact_id FROM invoices i
     JOIN customers c ON c.id = i.customer_id
     WHERE i.id = $1 AND i.tenant_id = $2 AND i.deleted_at IS NULL`,
    [invoiceId, tenantId],
  );
  const invoice = invRes.rows[0];
  if (!invoice) throw new AppError(404, 'Invoice not found');

  if (!invoice.xero_contact_id) {
    throw new AppError(400, 'Customer must be synced to Xero before syncing invoice');
  }

  // Get line items
  const lineRes = await queryDb<Record<string, unknown>>(
    `SELECT * FROM invoice_line_items WHERE invoice_id = $1 AND tenant_id = $2`,
    [invoiceId, tenantId],
  );

  const log = await repo.createSyncLog(tenantId, 'xero', 'push', 'invoice', invoiceId);
  const startTime = Date.now();

  try {
    const xeroInvoice = xeroMapper.mapInvoiceToXeroInvoice(
      invoice, lineRes.rows, invoice.xero_contact_id as string,
    );
    const result = await xeroClient.pushInvoice(tenantId, xeroInvoice);

    // Store xero_invoice_id and update sync status
    await queryDb(
      `UPDATE invoices SET xero_invoice_id = $1, xero_sync_status = 'synced'
       WHERE id = $2 AND tenant_id = $3`,
      [result.InvoiceID, invoiceId, tenantId],
    );

    await repo.updateSyncLog(log.id, 'success', result.InvoiceID, null, xeroInvoice, result, Date.now() - startTime);
    return { xero_invoice_id: result.InvoiceID };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await repo.updateSyncLog(log.id, 'failed', null, msg, null, null, Date.now() - startTime);

    // Mark sync as failed
    await queryDb(
      `UPDATE invoices SET xero_sync_status = 'error' WHERE id = $1 AND tenant_id = $2`,
      [invoiceId, tenantId],
    );

    throw new AppError(502, `Xero sync failed: ${msg}`);
  }
}

// ======== Sync Payment ========

export async function syncPayment(tenantId: string, paymentId: string, _userId: string) {
  await integrationService.getActiveConfig(tenantId, 'xero');

  const payRes = await queryDb<Record<string, unknown>>(
    `SELECT p.*, i.xero_invoice_id FROM invoice_payments p
     JOIN invoices i ON i.id = p.invoice_id
     WHERE p.id = $1 AND p.tenant_id = $2`,
    [paymentId, tenantId],
  );
  const payment = payRes.rows[0];
  if (!payment) throw new AppError(404, 'Payment not found');

  if (!payment.xero_invoice_id) {
    throw new AppError(400, 'Invoice must be synced to Xero before syncing payment');
  }

  const log = await repo.createSyncLog(tenantId, 'xero', 'push', 'payment', paymentId);
  const startTime = Date.now();

  try {
    const xeroPayment = xeroMapper.mapPaymentToXeroPayment(
      payment, payment.xero_invoice_id as string,
    );
    const result = await xeroClient.pushPayment(tenantId, xeroPayment);

    await repo.updateSyncLog(log.id, 'success', result.PaymentID, null, xeroPayment, result, Date.now() - startTime);
    return { xero_payment_id: result.PaymentID };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await repo.updateSyncLog(log.id, 'failed', null, msg, null, null, Date.now() - startTime);
    throw new AppError(502, `Xero sync failed: ${msg}`);
  }
}

// ======== Full Sync ========

export async function fullSync(tenantId: string, userId: string) {
  await integrationService.getActiveConfig(tenantId, 'xero');

  const results = { customers: 0, invoices: 0, errors: 0 };

  // Sync unsynced customers
  const unsyncedCustomers = await queryDb<{ id: string }>(
    `SELECT id FROM customers WHERE tenant_id = $1 AND xero_contact_id IS NULL AND deleted_at IS NULL`,
    [tenantId],
  );
  for (const c of unsyncedCustomers.rows) {
    try {
      await syncCustomer(tenantId, c.id, userId);
      results.customers++;
    } catch {
      results.errors++;
    }
  }

  // Sync unsynced invoices (only if customer is already synced)
  const unsyncedInvoices = await queryDb<{ id: string }>(
    `SELECT i.id FROM invoices i
     JOIN customers c ON c.id = i.customer_id
     WHERE i.tenant_id = $1 AND i.xero_invoice_id IS NULL
       AND c.xero_contact_id IS NOT NULL
       AND i.deleted_at IS NULL AND i.status IN ('sent', 'overdue')`,
    [tenantId],
  );
  for (const inv of unsyncedInvoices.rows) {
    try {
      await syncInvoice(tenantId, inv.id, userId);
      results.invoices++;
    } catch {
      results.errors++;
    }
  }

  await repo.updateLastSync(tenantId, 'xero');
  return results;
}
