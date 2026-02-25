import type { Request, Response, NextFunction } from 'express';
import * as subcontractorService from './service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await subcontractorService.listSubcontractors(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const sub = await subcontractorService.getSubcontractor(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: sub });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const sub = await subcontractorService.createSubcontractor(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: sub });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const sub = await subcontractorService.updateSubcontractor(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data: sub });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await subcontractorService.deleteSubcontractor(req.tenantId!, req.params.id);
    res.json({ status: 'success', message: 'Subcontractor deleted' });
  } catch (err) {
    next(err);
  }
}
