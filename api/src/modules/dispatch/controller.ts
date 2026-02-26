import type { Request, Response, NextFunction } from 'express';
import * as dispatchService from './service.js';
import type { BoardQuery, AssignJobData, RescheduleJobData, UnassignJobData } from './schema.js';

export async function getBoard(req: Request, res: Response, next: NextFunction) {
  try {
    const query = req.query as unknown as BoardQuery;
    const data = await dispatchService.getBoardData(req.tenantId!, query);
    res.json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
}

export async function getQueue(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await dispatchService.getQueueData(req.tenantId!);
    res.json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
}

export async function assignJob(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as AssignJobData;
    const result = await dispatchService.assignJob(req.tenantId!, req.user!.id, input);
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function rescheduleJob(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as RescheduleJobData;
    const result = await dispatchService.rescheduleJob(req.tenantId!, req.user!.id, input);
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function unassignJob(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as UnassignJobData;
    const result = await dispatchService.unassignJob(req.tenantId!, req.user!.id, input);
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}
