import { Request, Response, NextFunction } from 'express';
import * as service from './service.js';

export async function getCommandCenterSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await service.getCommandCenterSummary(req.tenantId!);
    res.json({ status: 'success', data: summary });
  } catch (err) { next(err); }
}
