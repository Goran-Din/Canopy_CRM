import type { Request, Response, NextFunction } from 'express';
import * as snowService from './service.js';

// ======== SEASONS ========

export async function listSeasons(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await snowService.listSeasons(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function getSeason(req: Request, res: Response, next: NextFunction) {
  try {
    const season = await snowService.getSeason(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: season });
  } catch (err) {
    next(err);
  }
}

export async function createSeason(req: Request, res: Response, next: NextFunction) {
  try {
    const season = await snowService.createSeason(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: season });
  } catch (err) {
    next(err);
  }
}

export async function updateSeason(req: Request, res: Response, next: NextFunction) {
  try {
    const season = await snowService.updateSeason(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data: season });
  } catch (err) {
    next(err);
  }
}

export async function deleteSeason(req: Request, res: Response, next: NextFunction) {
  try {
    await snowService.deleteSeason(req.tenantId!, req.params.id);
    res.json({ status: 'success', message: 'Season deleted' });
  } catch (err) {
    next(err);
  }
}

// ======== RUNS ========

export async function listRuns(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await snowService.listRuns(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function getRun(req: Request, res: Response, next: NextFunction) {
  try {
    const run = await snowService.getRun(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: run });
  } catch (err) {
    next(err);
  }
}

export async function createRun(req: Request, res: Response, next: NextFunction) {
  try {
    const run = await snowService.createRun(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: run });
  } catch (err) {
    next(err);
  }
}

export async function updateRun(req: Request, res: Response, next: NextFunction) {
  try {
    const run = await snowService.updateRun(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data: run });
  } catch (err) {
    next(err);
  }
}

export async function changeRunStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const run = await snowService.changeRunStatus(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data: run });
  } catch (err) {
    next(err);
  }
}

// ======== ENTRIES ========

export async function addEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const entry = await snowService.addEntry(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: entry });
  } catch (err) {
    next(err);
  }
}

export async function bulkCreateEntries(req: Request, res: Response, next: NextFunction) {
  try {
    const entries = await snowService.bulkCreateEntries(req.tenantId!, req.params.id, req.user!.id);
    res.status(201).json({ status: 'success', data: entries });
  } catch (err) {
    next(err);
  }
}

export async function updateEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const entry = await snowService.updateEntry(req.tenantId!, req.params.entryId, req.body, req.user!.id);
    res.json({ status: 'success', data: entry });
  } catch (err) {
    next(err);
  }
}

export async function changeEntryStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const entry = await snowService.changeEntryStatus(req.tenantId!, req.params.entryId, req.body, req.user!.id);
    res.json({ status: 'success', data: entry });
  } catch (err) {
    next(err);
  }
}

// ======== STATS ========

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await snowService.getSnowStats(req.tenantId!);
    res.json({ status: 'success', data: stats });
  } catch (err) {
    next(err);
  }
}
