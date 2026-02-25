import type { Request, Response, NextFunction } from 'express';
import * as hardscapeService from './service.js';

// ======== PROJECTS ========

export async function listProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await hardscapeService.listProjects(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function getProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await hardscapeService.getProject(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: project });
  } catch (err) {
    next(err);
  }
}

export async function createProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await hardscapeService.createProject(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: project });
  } catch (err) {
    next(err);
  }
}

export async function updateProject(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await hardscapeService.updateProject(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data: project });
  } catch (err) {
    next(err);
  }
}

export async function changeStage(req: Request, res: Response, next: NextFunction) {
  try {
    const project = await hardscapeService.changeStage(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data: project });
  } catch (err) {
    next(err);
  }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction) {
  try {
    await hardscapeService.deleteProject(req.tenantId!, req.params.id);
    res.json({ status: 'success', message: 'Project deleted' });
  } catch (err) {
    next(err);
  }
}

// ======== MILESTONES ========

export async function listMilestones(req: Request, res: Response, next: NextFunction) {
  try {
    const milestones = await hardscapeService.listMilestones(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: milestones });
  } catch (err) {
    next(err);
  }
}

export async function addMilestone(req: Request, res: Response, next: NextFunction) {
  try {
    const milestone = await hardscapeService.addMilestone(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: milestone });
  } catch (err) {
    next(err);
  }
}

export async function updateMilestone(req: Request, res: Response, next: NextFunction) {
  try {
    const milestone = await hardscapeService.updateMilestone(req.tenantId!, req.params.milestoneId, req.body, req.user!.id);
    res.json({ status: 'success', data: milestone });
  } catch (err) {
    next(err);
  }
}

// ======== STAGE HISTORY ========

export async function getStageHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const history = await hardscapeService.getStageHistory(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: history });
  } catch (err) {
    next(err);
  }
}

// ======== PIPELINE ========

export async function getPipelineStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await hardscapeService.getPipelineStats(req.tenantId!);
    res.json({ status: 'success', data: stats });
  } catch (err) {
    next(err);
  }
}
