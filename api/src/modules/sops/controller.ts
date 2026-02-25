import type { Request, Response, NextFunction } from 'express';
import * as sopService from './service.js';

// ======== Templates ========

export async function listTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await sopService.listTemplates(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
}

export async function getTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await sopService.getTemplate(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: template });
  } catch (err) { next(err); }
}

export async function createTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await sopService.createTemplate(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: template });
  } catch (err) { next(err); }
}

export async function updateTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await sopService.updateTemplate(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data: template });
  } catch (err) { next(err); }
}

export async function deleteTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    await sopService.deleteTemplate(req.tenantId!, req.params.id);
    res.json({ status: 'success', message: 'Template deleted' });
  } catch (err) { next(err); }
}

export async function duplicateTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await sopService.duplicateTemplate(req.tenantId!, req.params.id, req.user!.id);
    res.status(201).json({ status: 'success', data: template });
  } catch (err) { next(err); }
}

// ======== Steps ========

export async function addStep(req: Request, res: Response, next: NextFunction) {
  try {
    const step = await sopService.addStep(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: step });
  } catch (err) { next(err); }
}

export async function updateStep(req: Request, res: Response, next: NextFunction) {
  try {
    const step = await sopService.updateStep(req.tenantId!, req.params.stepId, req.body, req.user!.id);
    res.json({ status: 'success', data: step });
  } catch (err) { next(err); }
}

export async function deleteStep(req: Request, res: Response, next: NextFunction) {
  try {
    await sopService.deleteStep(req.tenantId!, req.params.stepId);
    res.json({ status: 'success', message: 'Step deleted' });
  } catch (err) { next(err); }
}

export async function reorderSteps(req: Request, res: Response, next: NextFunction) {
  try {
    const steps = await sopService.reorderSteps(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data: steps });
  } catch (err) { next(err); }
}

// ======== Assignments ========

export async function listAssignments(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await sopService.listAssignments(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
}

export async function getAssignment(req: Request, res: Response, next: NextFunction) {
  try {
    const assignment = await sopService.getAssignment(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: assignment });
  } catch (err) { next(err); }
}

export async function createAssignment(req: Request, res: Response, next: NextFunction) {
  try {
    const assignment = await sopService.createAssignment(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: assignment });
  } catch (err) { next(err); }
}

export async function updateAssignmentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const assignment = await sopService.updateAssignmentStatus(
      req.tenantId!, req.params.id, req.body, req.user!.id,
    );
    res.json({ status: 'success', data: assignment });
  } catch (err) { next(err); }
}

// ======== Step Completions ========

export async function completeStepAction(req: Request, res: Response, next: NextFunction) {
  try {
    const completion = await sopService.completeStep(
      req.tenantId!, req.params.assignmentId, req.params.stepId, req.body, req.user!.id,
    );
    res.json({ status: 'success', data: completion });
  } catch (err) { next(err); }
}
