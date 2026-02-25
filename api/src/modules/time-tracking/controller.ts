import type { Request, Response, NextFunction } from 'express';
import * as timeService from './service.js';

// ======== TIME ENTRIES ========

export async function listEntries(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await timeService.listEntries(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function getEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const entry = await timeService.getEntry(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: entry });
  } catch (err) {
    next(err);
  }
}

export async function clockIn(req: Request, res: Response, next: NextFunction) {
  try {
    // The target user is the requesting user by default
    const entry = await timeService.clockIn(
      req.tenantId!,
      req.body,
      req.user!.id,
    );
    res.status(201).json({ status: 'success', data: entry });
  } catch (err) {
    next(err);
  }
}

export async function clockOut(req: Request, res: Response, next: NextFunction) {
  try {
    const entry = await timeService.clockOut(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: entry });
  } catch (err) {
    next(err);
  }
}

export async function updateEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const entry = await timeService.updateEntry(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: entry });
  } catch (err) {
    next(err);
  }
}

export async function approveEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const entry = await timeService.approveEntry(
      req.tenantId!,
      req.params.id,
      req.user!.id,
    );
    res.json({ status: 'success', data: entry });
  } catch (err) {
    next(err);
  }
}

export async function getMyTimesheet(req: Request, res: Response, next: NextFunction) {
  try {
    const entries = await timeService.getMyTimesheet(
      req.tenantId!,
      req.user!.id,
      req.query as never,
    );
    res.json({ status: 'success', data: entries });
  } catch (err) {
    next(err);
  }
}

export async function getDailySummary(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await timeService.getDailySummary(req.tenantId!, req.query as never);
    res.json({ status: 'success', data: summary });
  } catch (err) {
    next(err);
  }
}

export async function getWeeklySummary(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await timeService.getWeeklySummary(req.tenantId!, req.query as never);
    res.json({ status: 'success', data: summary });
  } catch (err) {
    next(err);
  }
}

// ======== GPS EVENTS ========

export async function recordGpsEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const event = await timeService.recordGpsEvent(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: event });
  } catch (err) {
    next(err);
  }
}

export async function getGpsEventsByJob(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await timeService.getGpsEventsByJob(req.tenantId!, req.params.jobId);
    res.json({ status: 'success', data: events });
  } catch (err) {
    next(err);
  }
}

export async function getGpsEventsByUser(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await timeService.getGpsEventsByUser(
      req.tenantId!,
      req.params.userId,
      req.query as never,
    );
    res.json({ status: 'success', data: events });
  } catch (err) {
    next(err);
  }
}

export async function getLatestGpsByUser(req: Request, res: Response, next: NextFunction) {
  try {
    const event = await timeService.getLatestGpsByUser(req.tenantId!, req.params.userId);
    res.json({ status: 'success', data: event });
  } catch (err) {
    next(err);
  }
}
