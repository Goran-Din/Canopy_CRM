import type { Request, Response, NextFunction } from 'express';
import * as prospectService from './service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await prospectService.listProspects(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const prospect = await prospectService.getProspect(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: prospect });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const prospect = await prospectService.createProspect(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: prospect });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const prospect = await prospectService.updateProspect(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data: prospect });
  } catch (err) {
    next(err);
  }
}

export async function changeStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const prospect = await prospectService.changeStatus(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data: prospect });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await prospectService.deleteProspect(req.tenantId!, req.params.id);
    res.json({ status: 'success', message: 'Prospect deleted' });
  } catch (err) {
    next(err);
  }
}

export async function pipelineStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await prospectService.getPipelineStats(req.tenantId!);
    res.json({ status: 'success', data: stats });
  } catch (err) {
    next(err);
  }
}
