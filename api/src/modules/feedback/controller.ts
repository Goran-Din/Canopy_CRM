import type { Request, Response, NextFunction } from 'express';
import * as feedbackService from './service.js';

// === Public (no auth) ===

export async function getFeedbackPage(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await feedbackService.getFeedbackPageData(req.params.token);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function submitFeedback(req: Request, res: Response, next: NextFunction) {
  try {
    const ip = req.ip || req.socket.remoteAddress || undefined;
    const result = await feedbackService.submitFeedback(req.body, ip);
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
}

export async function recordReviewClick(req: Request, res: Response, next: NextFunction) {
  try {
    await feedbackService.recordReviewClick(req.params.token);
    res.json({ status: 'success', message: 'Review click recorded' });
  } catch (err) { next(err); }
}

// === Staff (auth required) ===

export async function listFeedback(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await feedbackService.listFeedback(req.tenantId!, req.query as never);
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
}

export async function getFeedbackSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await feedbackService.getFeedbackSummary(req.tenantId!);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function addStaffNote(req: Request, res: Response, next: NextFunction) {
  try {
    const feedback = await feedbackService.addStaffNote(
      req.params.id, req.tenantId!, req.body, req.user!.id,
    );
    res.json({ status: 'success', data: feedback });
  } catch (err) { next(err); }
}
