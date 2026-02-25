import type { Request, Response, NextFunction } from 'express';
import * as notificationService from './service.js';

export async function listNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await notificationService.listNotifications(req.tenantId!, req.user!.id, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await notificationService.getUnreadCount(req.tenantId!, req.user!.id);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await notificationService.markAsRead(req.tenantId!, req.user!.id, req.params.id);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function markAllAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await notificationService.markAllAsRead(req.tenantId!, req.user!.id);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function getPreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await notificationService.getPreferences(req.tenantId!, req.user!.id);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function updatePreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await notificationService.updatePreferences(req.tenantId!, req.user!.id, req.body);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}
