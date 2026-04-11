import type { Request, Response, NextFunction } from 'express';
import * as fileService from './service.js';

// === Folders ===

export async function listFolders(req: Request, res: Response, next: NextFunction) {
  try {
    const userRole = req.user!.roles?.[0]?.role_name || req.user!.roles?.[0]?.role || '';
    const includeInternal = userRole !== 'client';
    const folders = await fileService.listFolders(
      req.tenantId!,
      req.params.customerId,
      includeInternal,
    );
    res.json({ status: 'success', data: folders });
  } catch (err) {
    next(err);
  }
}

export async function createFolder(req: Request, res: Response, next: NextFunction) {
  try {
    const folder = await fileService.createFolder(
      req.tenantId!,
      req.body,
      req.user!.id,
    );
    res.status(201).json({ status: 'success', data: folder });
  } catch (err) {
    next(err);
  }
}

// === Upload Flow ===

export async function getUploadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const userRole = req.user!.roles?.[0]?.role_name || req.user!.roles?.[0]?.role || '';
    const isClientUpload = userRole === 'client';
    const result = await fileService.getUploadUrl(
      req.tenantId!,
      req.body,
      req.user!.id,
      isClientUpload,
    );
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function confirmUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const file = await fileService.confirmUpload(
      req.tenantId!,
      req.body,
      req.user!.id,
    );
    res.status(201).json({ status: 'success', data: file });
  } catch (err) {
    next(err);
  }
}

// === File Operations ===

export async function getFile(req: Request, res: Response, next: NextFunction) {
  try {
    const file = await fileService.getFile(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: file });
  } catch (err) {
    next(err);
  }
}

export async function listFiles(req: Request, res: Response, next: NextFunction) {
  try {
    const userRole = req.user!.roles?.[0]?.role_name || req.user!.roles?.[0]?.role || '';
    const portalOnly = userRole === 'client';
    const result = await fileService.listFiles(
      req.tenantId!,
      req.params.customerId,
      req.query as never,
      portalOnly,
    );
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function getDownloadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const userRole = req.user!.roles?.[0]?.role_name || req.user!.roles?.[0]?.role || '';
    const clientIp = req.ip || req.socket.remoteAddress || '';
    const result = await fileService.getDownloadUrl(
      req.tenantId!,
      req.params.id,
      req.user!.id,
      userRole,
      clientIp,
    );
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function updateFile(req: Request, res: Response, next: NextFunction) {
  try {
    const file = await fileService.updateFile(
      req.tenantId!,
      req.params.id,
      req.body,
    );
    res.json({ status: 'success', data: file });
  } catch (err) {
    next(err);
  }
}

export async function deleteFile(req: Request, res: Response, next: NextFunction) {
  try {
    await fileService.deleteFile(req.tenantId!, req.params.id, req.user!.id);
    res.json({ status: 'success', message: 'File deleted' });
  } catch (err) {
    next(err);
  }
}
