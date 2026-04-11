import type { Request, Response, NextFunction } from 'express';
import * as billingService from './service.js';

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await billingService.getDashboard(req.tenantId!);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function listDrafts(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await billingService.listDrafts(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
}

export async function getDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const draft = await billingService.getDraft(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: draft });
  } catch (err) { next(err); }
}

export async function updateDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const draft = await billingService.updateDraft(req.tenantId!, req.params.id, req.body);
    res.json({ status: 'success', data: draft });
  } catch (err) { next(err); }
}

export async function approveDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const draft = await billingService.approveDraft(req.tenantId!, req.params.id, req.user!.id);
    res.json({ status: 'success', data: draft });
  } catch (err) { next(err); }
}

export async function rejectDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const draft = await billingService.rejectDraft(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data: draft });
  } catch (err) { next(err); }
}

export async function manualGenerateDrafts(req: Request, res: Response, next: NextFunction) {
  try {
    const billingDate = req.body.billing_date || new Date().toISOString().split('T')[0];
    const result = await billingService.generateMonthlyDrafts(req.tenantId!, billingDate);
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
}

export async function listSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await billingService.listSchedule(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
}

export async function listOverdue(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await billingService.listOverdue(req.tenantId!);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function triggerMilestone(req: Request, res: Response, next: NextFunction) {
  try {
    const draft = await billingService.triggerMilestone(req.tenantId!, req.params.id, req.user!.id);
    res.status(201).json({ status: 'success', data: draft });
  } catch (err) { next(err); }
}

// === Milestone CRUD ===

export async function listMilestones(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await billingService.listMilestones(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
}

export async function setupMilestones(req: Request, res: Response, next: NextFunction) {
  try {
    const milestones = await billingService.setupMilestones(
      req.tenantId!, req.params.id, req.body, req.user!.id,
    );
    res.status(201).json({ status: 'success', data: milestones });
  } catch (err) { next(err); }
}

export async function addMilestone(req: Request, res: Response, next: NextFunction) {
  try {
    const milestone = await billingService.addMilestone(
      req.tenantId!, req.params.id, req.body, req.user!.id,
    );
    res.status(201).json({ status: 'success', data: milestone });
  } catch (err) { next(err); }
}

export async function updateMilestone(req: Request, res: Response, next: NextFunction) {
  try {
    const milestone = await billingService.updateMilestoneFields(
      req.tenantId!, req.params.id, req.body, req.user!.id,
    );
    res.json({ status: 'success', data: milestone });
  } catch (err) { next(err); }
}

export async function generateMilestoneInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await billingService.generateMilestoneInvoice(
      req.tenantId!, req.params.id, req.user!.id,
    );
    res.status(201).json({ status: 'success', data: result });
  } catch (err) { next(err); }
}

export async function cancelMilestone(req: Request, res: Response, next: NextFunction) {
  try {
    const milestone = await billingService.cancelMilestone(
      req.tenantId!, req.params.id, req.body, req.user!.id,
    );
    res.json({ status: 'success', data: milestone });
  } catch (err) { next(err); }
}

export async function getHardscapeSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await billingService.getHardscapeSummary(req.tenantId!);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}
