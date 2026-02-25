import type { Request, Response, NextFunction } from 'express';
import * as invoiceService from './service.js';

// ======== INVOICES ========

export async function listInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await invoiceService.listInvoices(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function getInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await invoiceService.getInvoice(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: invoice });
  } catch (err) {
    next(err);
  }
}

export async function createInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await invoiceService.createInvoice(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: invoice });
  } catch (err) {
    next(err);
  }
}

export async function updateInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await invoiceService.updateInvoice(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data: invoice });
  } catch (err) {
    next(err);
  }
}

export async function changeStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await invoiceService.changeStatus(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data: invoice });
  } catch (err) {
    next(err);
  }
}

export async function deleteInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    await invoiceService.deleteInvoice(req.tenantId!, req.params.id);
    res.json({ status: 'success', message: 'Invoice deleted' });
  } catch (err) {
    next(err);
  }
}

// --- Line Items ---

export async function addLineItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await invoiceService.addLineItem(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: item });
  } catch (err) {
    next(err);
  }
}

export async function updateLineItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await invoiceService.updateLineItem(req.tenantId!, req.params.lineItemId, req.body, req.user!.id);
    res.json({ status: 'success', data: item });
  } catch (err) {
    next(err);
  }
}

export async function removeLineItem(req: Request, res: Response, next: NextFunction) {
  try {
    await invoiceService.removeLineItem(req.tenantId!, req.params.lineItemId, req.user!.id);
    res.json({ status: 'success', message: 'Line item removed' });
  } catch (err) {
    next(err);
  }
}

// --- Payments ---

export async function recordPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await invoiceService.recordPayment(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: payment });
  } catch (err) {
    next(err);
  }
}

export async function getPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const payments = await invoiceService.getPayments(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: payments });
  } catch (err) {
    next(err);
  }
}

// --- Generate ---

export async function generateFromContract(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await invoiceService.generateFromContract(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: invoice });
  } catch (err) {
    next(err);
  }
}

export async function generateFromJobs(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await invoiceService.generateFromJobs(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: invoice });
  } catch (err) {
    next(err);
  }
}

// --- Stats ---

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await invoiceService.getInvoiceStats(req.tenantId!);
    res.json({ status: 'success', data: stats });
  } catch (err) {
    next(err);
  }
}

export async function getAgingReport(req: Request, res: Response, next: NextFunction) {
  try {
    const report = await invoiceService.getAgingReport(req.tenantId!);
    res.json({ status: 'success', data: report });
  } catch (err) {
    next(err);
  }
}
