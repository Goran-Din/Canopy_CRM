import type { Request, Response, NextFunction } from 'express';
import * as customerService from './service.js';

export async function listCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await customerService.listCustomers(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function getCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await customerService.getCustomer(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: customer });
  } catch (err) {
    next(err);
  }
}

export async function createCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await customerService.createCustomer(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: customer });
  } catch (err) {
    next(err);
  }
}

export async function updateCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await customerService.updateCustomer(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: customer });
  } catch (err) {
    next(err);
  }
}

export async function deleteCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    await customerService.deleteCustomer(req.tenantId!, req.params.id);
    res.json({ status: 'success', message: 'Customer deleted' });
  } catch (err) {
    next(err);
  }
}

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await customerService.getCustomerStats(req.tenantId!);
    res.json({ status: 'success', data: stats });
  } catch (err) {
    next(err);
  }
}
