import type { Request, Response, NextFunction } from 'express';
import * as equipmentService from './service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await equipmentService.listEquipment(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const equipment = await equipmentService.getEquipment(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: equipment });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const equipment = await equipmentService.createEquipment(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: equipment });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const equipment = await equipmentService.updateEquipment(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data: equipment });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await equipmentService.deleteEquipment(req.tenantId!, req.params.id);
    res.json({ status: 'success', message: 'Equipment deleted' });
  } catch (err) {
    next(err);
  }
}
