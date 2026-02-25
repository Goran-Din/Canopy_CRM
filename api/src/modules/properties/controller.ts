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
