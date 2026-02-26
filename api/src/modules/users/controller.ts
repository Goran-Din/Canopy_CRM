import type { Request, Response, NextFunction } from 'express';
import * as userService from './service.js';

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await userService.listUsers(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await userService.getUser(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await userService.createUser(req.tenantId!, req.body);
    res.status(201).json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await userService.updateUser(req.tenantId!, req.params.id, req.body);
    res.json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    await userService.changePassword(req.tenantId!, req.params.id, req.body.password);
    res.json({ status: 'success', message: 'Password updated' });
  } catch (err) {
    next(err);
  }
}

export async function deactivateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await userService.deactivateUser(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
}

export async function activateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await userService.activateUser(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
}

export async function assignRole(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await userService.addRole(
      req.tenantId!,
      req.params.id,
      req.body.role,
      req.body.division_id ?? null,
    );
    res.json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
}

export async function removeRole(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await userService.deleteRole(req.tenantId!, req.params.id, req.params.role);
    res.json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
}

export async function assignDivision(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await userService.addDivision(req.tenantId!, req.params.id, req.body.division);
    res.json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
}

export async function removeDivision(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await userService.deleteDivision(req.tenantId!, req.params.id, req.params.division);
    res.json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
}

export async function getStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = await userService.getUserStats(req.tenantId!);
    res.json({ status: 'success', data: stats });
  } catch (err) {
    next(err);
  }
}
