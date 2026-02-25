import type { Request, Response, NextFunction } from 'express';
import * as seasonalService from './service.js';

export async function listTransitions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await seasonalService.listTransitions(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
}

export async function getTransition(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await seasonalService.getTransition(req.tenantId!, req.params.id);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function createTransition(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await seasonalService.createTransition(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function updateTransition(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await seasonalService.updateTransition(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function updateChecklist(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await seasonalService.updateChecklist(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function deleteTransition(req: Request, res: Response, next: NextFunction) {
  try {
    await seasonalService.deleteTransition(req.tenantId!, req.params.id);
    res.json({ status: 'success', message: 'Seasonal transition deleted' });
  } catch (err) { next(err); }
}
