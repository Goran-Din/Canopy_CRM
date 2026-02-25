import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../modules/auth/service.js';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ status: 'error', message: 'Missing or invalid authorization header' });
    return;
  }

  const token = header.slice(7);

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid token';
    res.status(401).json({ status: 'error', message });
  }
}
