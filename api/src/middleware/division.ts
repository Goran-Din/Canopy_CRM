import type { Request, Response, NextFunction } from 'express';

export function requireDivision(...allowedDivisions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Authentication required' });
      return;
    }

    // Owner role bypasses division restrictions
    if (req.user.roles.some((r) => r.role === 'owner')) {
      next();
      return;
    }

    const hasAccess = allowedDivisions.some((d) => req.user!.divisions.includes(d));
    if (!hasAccess) {
      res.status(403).json({ status: 'error', message: 'Division access denied' });
      return;
    }

    next();
  };
}
