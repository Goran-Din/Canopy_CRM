import type { Request, Response, NextFunction } from 'express';
import * as disputeService from './service.js';

// ======== DISPUTES ========

export async function listDisputes(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await disputeService.listDisputes(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function getDispute(req: Request, res: Response, next: NextFunction) {
  try {
    const dispute = await disputeService.getDispute(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: dispute });
  } catch (err) {
    next(err);
  }
}

export async function createDispute(req: Request, res: Response, next: NextFunction) {
  try {
    const dispute = await disputeService.createDispute(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: dispute });
  } catch (err) {
    next(err);
  }
}

export async function updateDispute(req: Request, res: Response, next: NextFunction) {
  try {
    const dispute = await disputeService.updateDispute(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data: dispute });
  } catch (err) {
    next(err);
  }
}

export async function resolveDispute(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await disputeService.resolveDispute(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await disputeService.getDisputeStats(req.tenantId!);
    res.json({ status: 'success', data: stats });
  } catch (err) {
    next(err);
  }
}

// ======== CREDIT NOTES ========

export async function listCreditNotes(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await disputeService.listCreditNotes(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function getCreditNote(req: Request, res: Response, next: NextFunction) {
  try {
    const creditNote = await disputeService.getCreditNote(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: creditNote });
  } catch (err) {
    next(err);
  }
}

export async function createCreditNote(req: Request, res: Response, next: NextFunction) {
  try {
    const creditNote = await disputeService.createCreditNote(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: creditNote });
  } catch (err) {
    next(err);
  }
}

export async function approveCreditNote(req: Request, res: Response, next: NextFunction) {
  try {
    const creditNote = await disputeService.approveCreditNote(req.tenantId!, req.params.id, req.user!.id);
    res.json({ status: 'success', data: creditNote });
  } catch (err) {
    next(err);
  }
}

export async function applyCreditNote(req: Request, res: Response, next: NextFunction) {
  try {
    const creditNote = await disputeService.applyCreditNote(req.tenantId!, req.params.id, req.user!.id);
    res.json({ status: 'success', data: creditNote });
  } catch (err) {
    next(err);
  }
}

export async function voidCreditNote(req: Request, res: Response, next: NextFunction) {
  try {
    const creditNote = await disputeService.voidCreditNote(req.tenantId!, req.params.id, req.user!.id);
    res.json({ status: 'success', data: creditNote });
  } catch (err) {
    next(err);
  }
}
