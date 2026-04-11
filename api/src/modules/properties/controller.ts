import type { Request, Response, NextFunction } from 'express';
import * as propertyService from './service.js';

export async function listProperties(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await propertyService.listProperties(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function getProperty(req: Request, res: Response, next: NextFunction) {
  try {
    const property = await propertyService.getProperty(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: property });
  } catch (err) {
    next(err);
  }
}

export async function getPropertiesByCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const properties = await propertyService.getPropertiesByCustomer(
      req.tenantId!,
      req.params.customerId,
    );
    res.json({ status: 'success', data: properties });
  } catch (err) {
    next(err);
  }
}

export async function createProperty(req: Request, res: Response, next: NextFunction) {
  try {
    const property = await propertyService.createProperty(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: property });
  } catch (err) {
    next(err);
  }
}

export async function updateProperty(req: Request, res: Response, next: NextFunction) {
  try {
    const property = await propertyService.updateProperty(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: property });
  } catch (err) {
    next(err);
  }
}

export async function deleteProperty(req: Request, res: Response, next: NextFunction) {
  try {
    await propertyService.deleteProperty(req.tenantId!, req.params.id);
    res.json({ status: 'success', message: 'Property deleted' });
  } catch (err) {
    next(err);
  }
}

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await propertyService.getPropertyStats(req.tenantId!);
    res.json({ status: 'success', data: stats });
  } catch (err) {
    next(err);
  }
}

// --- V2 Handlers ---

export async function getKnowledgeCard(req: Request, res: Response, next: NextFunction) {
  try {
    const card = await propertyService.getKnowledgeCard(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: card });
  } catch (err) { next(err); }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const property = await propertyService.updateProfile(req.tenantId!, req.params.id, req.body);
    res.json({ status: 'success', data: property });
  } catch (err) { next(err); }
}

export async function getServiceHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const history = await propertyService.getServiceHistory(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: history });
  } catch (err) { next(err); }
}

export async function getEstimationContext(req: Request, res: Response, next: NextFunction) {
  try {
    const context = await propertyService.getEstimationContext(
      req.tenantId!, req.params.id, req.query.service_code as string);
    res.json({ status: 'success', data: context });
  } catch (err) { next(err); }
}

export async function getCrewNotes(req: Request, res: Response, next: NextFunction) {
  try {
    const notes = await propertyService.getCrewNotes(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: notes });
  } catch (err) { next(err); }
}

export async function addCrewNote(req: Request, res: Response, next: NextFunction) {
  try {
    const note = await propertyService.addCrewNote(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: note });
  } catch (err) { next(err); }
}

export async function getPropertyPhotos(req: Request, res: Response, next: NextFunction) {
  try {
    const photos = await propertyService.getPropertyPhotos(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: photos });
  } catch (err) { next(err); }
}

export async function getJobHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const jobs = await propertyService.getJobHistory(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: jobs });
  } catch (err) { next(err); }
}

export async function getCategorySummary(req: Request, res: Response, next: NextFunction) {
  try {
    const summary = await propertyService.getCategorySummary(req.tenantId!);
    res.json({ status: 'success', data: summary });
  } catch (err) { next(err); }
}
