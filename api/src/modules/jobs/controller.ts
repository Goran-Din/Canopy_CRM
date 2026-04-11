import type { Request, Response, NextFunction } from 'express';
import * as jobService from './service.js';
import * as diaryService from './diary/diary.service.js';
import * as photosService from './photos/photos.service.js';
import * as badgesService from './badges/badges.service.js';

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

// --- V2 Handlers ---

export async function createJobV2(req: Request, res: Response, next: NextFunction) {
  try {
    const job = await jobService.createJobV2(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: job });
  } catch (err) {
    next(err);
  }
}

export async function changeStatusV2(req: Request, res: Response, next: NextFunction) {
  try {
    const job = await jobService.changeJobStatusV2(
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

export async function convertToWorkOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const job = await jobService.convertToWorkOrder(
      req.tenantId!,
      req.params.id,
      req.user!.id,
    );
    res.json({ status: 'success', data: job });
  } catch (err) {
    next(err);
  }
}

// Diary
export async function listDiaryEntries(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await diaryService.listDiaryEntries(
      req.tenantId!,
      req.params.id,
      req.query as never,
    );
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function addDiaryNote(req: Request, res: Response, next: NextFunction) {
  try {
    const entry = await diaryService.addDiaryNote(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.status(201).json({ status: 'success', data: entry });
  } catch (err) {
    next(err);
  }
}

// V2 Photos
export async function addPhotoV2(req: Request, res: Response, next: NextFunction) {
  try {
    const photo = await photosService.addPhoto(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.status(201).json({ status: 'success', data: photo });
  } catch (err) {
    next(err);
  }
}

export async function listPhotosV2(req: Request, res: Response, next: NextFunction) {
  try {
    const photos = await photosService.listPhotos(
      req.tenantId!,
      req.params.id,
      req.query.tag as string | undefined,
    );
    res.json({ status: 'success', data: photos });
  } catch (err) {
    next(err);
  }
}

export async function updatePhotoV2(req: Request, res: Response, next: NextFunction) {
  try {
    const photo = await photosService.updatePhoto(
      req.tenantId!,
      req.params.id,
      req.params.photoId,
      req.body,
    );
    res.json({ status: 'success', data: photo });
  } catch (err) {
    next(err);
  }
}

export async function deletePhotoV2(req: Request, res: Response, next: NextFunction) {
  try {
    await photosService.deletePhoto(req.tenantId!, req.params.id, req.params.photoId);
    res.json({ status: 'success', message: 'Photo deleted' });
  } catch (err) {
    next(err);
  }
}

// Badges
export async function listBadges(req: Request, res: Response, next: NextFunction) {
  try {
    const badges = await badgesService.listBadges(req.tenantId!);
    res.json({ status: 'success', data: badges });
  } catch (err) {
    next(err);
  }
}

export async function upsertBadge(req: Request, res: Response, next: NextFunction) {
  try {
    const badge = await badgesService.upsertBadge(req.tenantId!, req.body);
    res.status(201).json({ status: 'success', data: badge });
  } catch (err) {
    next(err);
  }
}

export async function assignBadges(req: Request, res: Response, next: NextFunction) {
  try {
    const job = await badgesService.assignBadgesToJob(
      req.tenantId!,
      req.params.id,
      req.body,
    );
    res.json({ status: 'success', data: job });
  } catch (err) {
    next(err);
  }
}
