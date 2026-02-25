import type { Request, Response, NextFunction } from 'express';
import * as contractService from './service.js';

export async function listContracts(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await contractService.listContracts(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function getContract(req: Request, res: Response, next: NextFunction) {
  try {
    const contract = await contractService.getContract(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: contract });
  } catch (err) {
    next(err);
  }
}

export async function createContract(req: Request, res: Response, next: NextFunction) {
  try {
    const contract = await contractService.createContract(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: contract });
  } catch (err) {
    next(err);
  }
}

export async function updateContract(req: Request, res: Response, next: NextFunction) {
  try {
    const contract = await contractService.updateContract(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: contract });
  } catch (err) {
    next(err);
  }
}

export async function changeStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const contract = await contractService.changeStatus(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: contract });
  } catch (err) {
    next(err);
  }
}

export async function deleteContract(req: Request, res: Response, next: NextFunction) {
  try {
    await contractService.deleteContract(req.tenantId!, req.params.id);
    res.json({ status: 'success', message: 'Contract deleted' });
  } catch (err) {
    next(err);
  }
}

export async function getLineItems(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await contractService.getLineItems(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: items });
  } catch (err) {
    next(err);
  }
}

export async function addLineItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await contractService.addLineItem(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.status(201).json({ status: 'success', data: item });
  } catch (err) {
    next(err);
  }
}

export async function updateLineItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await contractService.updateLineItem(
      req.tenantId!,
      req.params.lineItemId,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: item });
  } catch (err) {
    next(err);
  }
}

export async function removeLineItem(req: Request, res: Response, next: NextFunction) {
  try {
    await contractService.removeLineItem(req.tenantId!, req.params.lineItemId, req.user!.id);
    res.json({ status: 'success', message: 'Line item removed' });
  } catch (err) {
    next(err);
  }
}

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await contractService.getContractStats(req.tenantId!);
    res.json({ status: 'success', data: stats });
  } catch (err) {
    next(err);
  }
}
