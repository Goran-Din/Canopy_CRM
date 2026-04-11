import type { Request, Response, NextFunction } from 'express';
import * as templateService from './service.js';

// === Templates CRUD ===

export async function listTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await templateService.listTemplates(req.tenantId!, req.query as never);
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function getTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await templateService.getTemplate(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: template });
  } catch (err) {
    next(err);
  }
}

export async function createTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await templateService.createTemplate(
      req.tenantId!,
      req.body,
      req.user!.id,
    );
    res.status(201).json({ status: 'success', data: template });
  } catch (err) {
    next(err);
  }
}

export async function updateTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await templateService.updateTemplate(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: template });
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    await templateService.deleteTemplate(req.tenantId!, req.params.id);
    res.json({ status: 'success', message: 'Template deleted' });
  } catch (err) {
    next(err);
  }
}

// === Quote Integration ===

export async function saveFromQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await templateService.saveQuoteAsTemplate(
      req.tenantId!,
      req.body,
      req.user!.id,
    );
    res.status(201).json({ status: 'success', data: template });
  } catch (err) {
    next(err);
  }
}

export async function loadTemplateIntoQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const quote = await templateService.loadTemplateIntoQuote(
      req.params.id,
      req.body,
      req.tenantId!,
      req.user!.id,
    );
    res.json({ status: 'success', data: quote });
  } catch (err) {
    next(err);
  }
}

// === Automation Templates ===

export async function listAutomationTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const templates = await templateService.listAutomationTemplates(req.tenantId!);
    res.json({ status: 'success', data: templates });
  } catch (err) {
    next(err);
  }
}

export async function updateAutomationConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const template = await templateService.updateAutomationConfig(
      req.tenantId!,
      req.params.type,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: template });
  } catch (err) {
    next(err);
  }
}
