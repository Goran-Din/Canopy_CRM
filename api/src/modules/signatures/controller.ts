import type { Request, Response, NextFunction } from 'express';
import * as signatureService from './service.js';

// === Public Endpoints (no auth) ===

export async function getSigningPage(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await signatureService.getSigningPageData(req.params.token);
    res.json({ status: 'success', data });
  } catch (err) {
    next(err);
  }
}

export async function submitSignature(req: Request, res: Response, next: NextFunction) {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || '0.0.0.0';
    const userAgent = req.get('user-agent') || '';

    const result = await signatureService.processSignature(
      req.body,
      clientIp,
      userAgent,
    );
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

// === Staff Endpoints (authenticated) ===

export async function getSignatureDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const signature = await signatureService.getSignatureDetails(
      req.tenantId!,
      req.params.id,
    );
    res.json({ status: 'success', data: signature });
  } catch (err) {
    next(err);
  }
}
