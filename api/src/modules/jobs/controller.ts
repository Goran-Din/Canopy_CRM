import type { Request, Response, NextFunction } from 'express';
import * as jobService from './service.js';

export async function listJobs(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await jobService.listJobs(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function getJob(req: Request, res: Response, next: NextFunction) {
  try {
    const job = await jobService.getJob(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: job });
  } catch (err) {
    next(err);
  }
}

export async function createJob(req: Request, res: Response, next: NextFunction) {
  try {
    const job = await jobService.createJob(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: job });
  } catch (err) {
    next(err);
  }
}

export async function updateJob(req: Request, res: Response, next: NextFunction) {
  try {
    const job = await jobService.updateJob(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: job });
  } catch (err) {
    next(err);
  }
}

export async function changeStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const job = await jobService.changeJobStatus(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: job });
  } catch (err) {
    next(err);
  }
}

export async function deleteJob(req: Request, res: Response, next: NextFunction) {
  try {
    await jobService.deleteJob(req.tenantId!, req.params.id);
    res.json({ status: 'success', message: 'Job deleted' });
  } catch (err) {
    next(err);
  }
}

export async function getSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const jobs = await jobService.getSchedule(req.tenantId!, req.query as never);
    res.json({ status: 'success', data: jobs });
  } catch (err) {
    next(err);
  }
}

export async function getJobsByProperty(req: Request, res: Response, next: NextFunction) {
  try {
    const jobs = await jobService.getJobsByProperty(req.tenantId!, req.params.propertyId);
    res.json({ status: 'success', data: jobs });
  } catch (err) {
    next(err);
  }
}

export async function addPhoto(req: Request, res: Response, next: NextFunction) {
  try {
    const photo = await jobService.addPhoto(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: photo });
  } catch (err) {
    next(err);
  }
}

export async function getPhotos(req: Request, res: Response, next: NextFunction) {
  try {
    const photos = await jobService.getPhotos(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: photos });
  } catch (err) {
    next(err);
  }
}

export async function addChecklistItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await jobService.addChecklistItem(req.tenantId!, req.params.id, req.body);
    res.status(201).json({ status: 'success', data: item });
  } catch (err) {
    next(err);
  }
}

export async function updateChecklistItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await jobService.updateChecklistItem(
      req.tenantId!,
      req.params.itemId,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: item });
  } catch (err) {
    next(err);
  }
}

export async function getChecklist(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await jobService.getChecklist(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: items });
  } catch (err) {
    next(err);
  }
}

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await jobService.getJobStats(req.tenantId!);
    res.json({ status: 'success', data: stats });
  } catch (err) {
    next(err);
  }
}
