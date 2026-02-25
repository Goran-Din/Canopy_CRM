// ============================================
// Xero API Client — HTTP wrapper with OAuth2
// ============================================

import { env } from '../../../config/env.js';
import * as repo from '../repository.js';
import type {
  XeroContact, XeroInvoice, XeroPayment, XeroCreditNote,
} from './xero-mapper.js';

const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0';
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';

interface XeroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

async function getAccessToken(tenantId: string): Promise<{ token: string; xeroTenantId: string }> {
  const config = await repo.findConfigByProvider(tenantId, 'xero');
  if (!config) throw new Error('Xero integration not configured');
  if (config.status !== 'active') throw new Error('Xero integration not active');

  // Check if token is expired and refresh if needed
  if (config.token_expires_at) {
    const expiresAt = new Date(config.token_expires_at);
    const now = new Date();
    if (now >= expiresAt && config.refresh_token_encrypted) {
      await refreshAccessToken(tenantId, config.refresh_token_encrypted);
      const refreshed = await repo.findConfigByProvider(tenantId, 'xero');
      if (refreshed?.access_token_encrypted) {
        return {
          token: refreshed.access_token_encrypted,
          xeroTenantId: (refreshed.config_data as Record<string, string>).xero_tenant_id || '',
        };
      }
    }
  }

  return {
    token: config.access_token_encrypted || '',
    xeroTenantId: (config.config_data as Record<string, string>).xero_tenant_id || '',
  };
}

async function refreshAccessToken(tenantId: string, refreshToken: string): Promise<void> {
  const clientId = env.XERO_CLIENT_ID || '';
  const clientSecret = env.XERO_CLIENT_SECRET || '';

  const response = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    await repo.updateLastError(tenantId, 'xero', `Token refresh failed: ${errorText}`);
    throw new Error('Failed to refresh Xero token');
  }

  const data = (await response.json()) as XeroTokenResponse;
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await repo.updateTokens(tenantId, 'xero', data.access_token, data.refresh_token, expiresAt);
}

async function xeroRequest(
  tenantId: string, method: string, path: string, body?: unknown,
): Promise<unknown> {
  const { token, xeroTenantId } = await getAccessToken(tenantId);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (xeroTenantId) {
    headers['xero-tenant-id'] = xeroTenantId;
  }

  const response = await fetch(`${XERO_API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Xero API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// ======== Public API Methods ========

export async function pushContact(
  tenantId: string, contact: XeroContact,
): Promise<{ ContactID: string }> {
  const startTime = Date.now();
  const log = await repo.createSyncLog(tenantId, 'xero', 'push', 'contact', tenantId);

  try {
    const result = await xeroRequest(tenantId, 'POST', '/Contacts', {
      Contacts: [contact],
    }) as { Contacts: Array<{ ContactID: string }> };

    const xeroContact = result.Contacts[0];
    await repo.updateSyncLog(
      log.id, 'success', xeroContact.ContactID, null,
      contact, result, Date.now() - startTime,
    );
    await repo.updateLastSync(tenantId, 'xero');
    return xeroContact;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await repo.updateSyncLog(log.id, 'failed', null, msg, contact, null, Date.now() - startTime);
    throw err;
  }
}

export async function pushInvoice(
  tenantId: string, invoice: XeroInvoice,
): Promise<{ InvoiceID: string; InvoiceNumber: string }> {
  const startTime = Date.now();
  const log = await repo.createSyncLog(tenantId, 'xero', 'push', 'invoice', tenantId);

  try {
    const result = await xeroRequest(tenantId, 'POST', '/Invoices', {
      Invoices: [invoice],
    }) as { Invoices: Array<{ InvoiceID: string; InvoiceNumber: string }> };

    const xeroInvoice = result.Invoices[0];
    await repo.updateSyncLog(
      log.id, 'success', xeroInvoice.InvoiceID, null,
      invoice, result, Date.now() - startTime,
    );
    await repo.updateLastSync(tenantId, 'xero');
    return xeroInvoice;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await repo.updateSyncLog(log.id, 'failed', null, msg, invoice, null, Date.now() - startTime);
    throw err;
  }
}

export async function pushPayment(
  tenantId: string, payment: XeroPayment,
): Promise<{ PaymentID: string }> {
  const startTime = Date.now();
  const log = await repo.createSyncLog(tenantId, 'xero', 'push', 'payment', tenantId);

  try {
    const result = await xeroRequest(tenantId, 'POST', '/Payments', {
      Payments: [payment],
    }) as { Payments: Array<{ PaymentID: string }> };

    const xeroPayment = result.Payments[0];
    await repo.updateSyncLog(
      log.id, 'success', xeroPayment.PaymentID, null,
      payment, result, Date.now() - startTime,
    );
    await repo.updateLastSync(tenantId, 'xero');
    return xeroPayment;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await repo.updateSyncLog(log.id, 'failed', null, msg, payment, null, Date.now() - startTime);
    throw err;
  }
}

export async function pushCreditNote(
  tenantId: string, creditNote: XeroCreditNote,
): Promise<{ CreditNoteID: string }> {
  const startTime = Date.now();
  const log = await repo.createSyncLog(tenantId, 'xero', 'push', 'credit_note', tenantId);

  try {
    const result = await xeroRequest(tenantId, 'POST', '/CreditNotes', {
      CreditNotes: [creditNote],
    }) as { CreditNotes: Array<{ CreditNoteID: string }> };

    const xeroCreditNote = result.CreditNotes[0];
    await repo.updateSyncLog(
      log.id, 'success', xeroCreditNote.CreditNoteID, null,
      creditNote, result, Date.now() - startTime,
    );
    await repo.updateLastSync(tenantId, 'xero');
    return xeroCreditNote;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await repo.updateSyncLog(log.id, 'failed', null, msg, creditNote, null, Date.now() - startTime);
    throw err;
  }
}

export async function getInvoiceStatus(
  tenantId: string, xeroInvoiceId: string,
): Promise<{ Status: string; AmountDue: number; AmountPaid: number }> {
  const result = await xeroRequest(tenantId, 'GET', `/Invoices/${xeroInvoiceId}`) as {
    Invoices: Array<{ Status: string; AmountDue: number; AmountPaid: number }>;
  };
  return result.Invoices[0];
}
