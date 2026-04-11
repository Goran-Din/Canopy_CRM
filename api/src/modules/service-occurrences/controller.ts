import type { Request, Response, NextFunction } from 'express';
import * as occService from './service.js';

export async function generateOccurrences(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await occService.generateOccurrences(
      req.tenantId!,
      req.params.contractId,
      req.body.season_year,
      req.user!.id,
    );
    res.status(201).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function listOccurrences(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await occService.listOccurrences(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function getOccurrence(req: Request, res: Response, next: NextFunction) {
  try {
    const occ = await occService.getOccurrence(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: occ });
  } catch (err) {
    next(err);
  }
}

export async function assignOccurrence(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await occService.assignOccurrence(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function bulkAssign(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await occService.bulkAssign(req.tenantId!, req.body, req.user!.id);
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function skipOccurrence(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await occService.skipOccurrence(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function markCompleted(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await occService.markCompleted(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function getServiceListSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await occService.getServiceListSummary(
      req.tenantId!,
      Number(req.query.season_year) || new Date().getFullYear(),
    );
    res.json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
}

export async function getServiceDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await occService.getServiceDetail(
      req.tenantId!,
      req.params.serviceCode,
      Number(req.query.occurrence_number),
      Number(req.query.season_year) || new Date().getFullYear(),
    );
    res.json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
}

export async function getSeasonSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await occService.getSeasonSummary(
      req.tenantId!,
      Number(req.query.season_year) || new Date().getFullYear(),
    );
    res.json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
}
