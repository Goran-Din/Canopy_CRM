import type { Request, Response, NextFunction } from 'express';
import * as integrationService from './service.js';
import * as xeroSync from './xero/xero-sync.js';

// ======== Integration Config ========

export async function listIntegrations(req: Request, res: Response, next: NextFunction) {
  try {
    const configs = await integrationService.listIntegrations(req.tenantId!);
    res.json({ status: 'success', data: configs });
  } catch (err) { next(err); }
}

export async function getIntegration(req: Request, res: Response, next: NextFunction) {
  try {
    const config = await integrationService.getIntegration(req.tenantId!, req.params.provider);
    res.json({ status: 'success', data: config });
  } catch (err) { next(err); }
}

export async function updateConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const config = await integrationService.updateConfig(req.tenantId!, req.params.provider, req.body, req.user!.id);
    res.json({ status: 'success', data: config });
  } catch (err) { next(err); }
}

export async function connect(req: Request, res: Response, next: NextFunction) {
  try {
    const config = await integrationService.connect(req.tenantId!, req.params.provider, req.body, req.user!.id);
    res.json({ status: 'success', data: config });
  } catch (err) { next(err); }
}

export async function disconnect(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await integrationService.disconnect(req.tenantId!, req.params.provider);
    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
}

// ======== Xero Sync ========

export async function syncCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await xeroSync.syncCustomer(req.tenantId!, req.params.customerId, req.user!.id);
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
}

export async function syncInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await xeroSync.syncInvoice(req.tenantId!, req.params.invoiceId, req.user!.id);
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
}

export async function syncPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await xeroSync.syncPayment(req.tenantId!, req.params.paymentId, req.user!.id);
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
}

export async function fullSync(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await xeroSync.fullSync(req.tenantId!, req.user!.id);
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
}

// ======== Sync Log ========

export async function getSyncLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await integrationService.getSyncLogs(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
}

export async function getSyncLogsByEntity(req: Request, res: Response, next: NextFunction) {
  try {
    const logs = await integrationService.getSyncLogsByEntity(req.tenantId!, req.params.entityId);
    res.json({ status: 'success', data: logs });
  } catch (err) { next(err); }
}

// ======== Xero Items Sync ========

export async function triggerItemSync(req: Request, res: Response, next: NextFunction) {
  try {
    const { syncXeroItems } = await import('./xero/xero-items.js');
    const result = await syncXeroItems(req.tenantId!, true);
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
}

// ======== NorthChat Webhook ========

export async function handleNorthChatWebhookCtrl(req: Request, res: Response, next: NextFunction) {
  try {
    const { handleNorthChatWebhook } = await import('./northchat/northchat-webhook.js');
    const result = await handleNorthChatWebhook(req.tenantId!, req.body);
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
}

export async function northchatJobLookup(req: Request, res: Response, next: NextFunction) {
  try {
    const { lookupJob } = await import('./northchat/northchat-webhook.js');
    const result = await lookupJob(req.tenantId!, req.query.job_number as string);
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
}

// ======== Canopy Quotes Conversion ========

export async function convertQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const { convertQuoteToJob } = await import('./canopy-quotes/convert-service.js');
    const result = await convertQuoteToJob(req.tenantId!, req.body);
    res.status(201).json({ status: 'success', data: result });
  } catch (err) { next(err); }
}

// ======== Stub Integration Endpoints ========

export async function stubEndpoint(req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      status: 'success',
      message: 'Integration stub — not yet implemented',
      data: null,
    });
  } catch (err) { next(err); }
}
