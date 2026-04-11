import type { Request, Response, NextFunction } from 'express';
import * as automationService from './service.js';

export async function listConfigs(req: Request, res: Response, next: NextFunction) {
  try {
    const configs = await automationService.listConfigs(req.tenantId!);
    res.json({ status: 'success', data: configs });
  } catch (err) { next(err); }
}

export async function getConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const config = await automationService.getConfig(req.tenantId!, req.params.type);
    res.json({ status: 'success', data: config });
  } catch (err) { next(err); }
}

export async function updateConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const config = await automationService.updateConfig(
      req.tenantId!, req.params.type, req.body, req.user!.id,
    );
    res.json({ status: 'success', data: config });
  } catch (err) { next(err); }
}

export async function listLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await automationService.listLogs(req.tenantId!, req.query as never);
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
}

export async function testSend(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await automationService.sendTestMessage(req.tenantId!, req.body);
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
}
