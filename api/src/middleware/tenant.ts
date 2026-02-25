import type { Request, Response, NextFunction } from 'express';

export function tenantScope(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ status: 'error', message: 'Authentication required' });
    return;
  }

  req.tenantId = req.user.tenant_id;

  const paramTenantId = req.params.tenantId || req.body?.tenant_id;
  if (paramTenantId && paramTenantId !== req.tenantId) {
    res.status(403).json({ status: 'error', message: 'Cross-tenant access denied' });
    return;
  }

  next();
}
