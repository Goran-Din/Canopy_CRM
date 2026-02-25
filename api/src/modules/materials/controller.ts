import type { Request, Response, NextFunction } from 'express';
import * as materialService from './service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await materialService.listMaterials(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const material = await materialService.getMaterial(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: material });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const material = await materialService.createMaterial(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: material });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const material = await materialService.updateMaterial(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data: material });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await materialService.deleteMaterial(req.tenantId!, req.params.id);
    res.json({ status: 'success', message: 'Material deleted' });
  } catch (err) {
    next(err);
  }
}

export async function recordTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const transaction = await materialService.recordTransaction(
      req.tenantId!, req.params.id, req.body, req.user!.id,
    );
    res.status(201).json({ status: 'success', data: transaction });
  } catch (err) {
    next(err);
  }
}

export async function listTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await materialService.listTransactions(
      req.tenantId!, req.params.id, req.query as never,
    );
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function lowStock(req: Request, res: Response, next: NextFunction) {
  try {
    const materials = await materialService.getLowStock(req.tenantId!);
    res.json({ status: 'success', data: materials });
  } catch (err) {
    next(err);
  }
}
