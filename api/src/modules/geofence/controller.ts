import type { Request, Response, NextFunction } from 'express';
import * as geofenceService from './service.js';

export async function recordGpsEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const event = await geofenceService.recordGpsEvent(
      req.tenantId!, req.user!.id, req.body,
    );
    res.status(201).json({ status: 'success', data: event });
  } catch (err) { next(err); }
}

export async function getLiveCrewPositions(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await geofenceService.getLiveCrewPositions(req.tenantId!);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function getEventsByJob(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await geofenceService.getEventsByJob(req.params.jobId, req.tenantId!);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function getEventsByProperty(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await geofenceService.getEventsByProperty(
      req.params.propertyId, req.tenantId!, req.query as never,
    );
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function getPropertyGeofence(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await geofenceService.getPropertyGeofence(req.params.id, req.tenantId!);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function updatePropertyGeofence(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await geofenceService.updatePropertyGeofence(
      req.params.id, req.tenantId!, req.body, req.user!.id,
    );
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function getGeofenceSetupStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await geofenceService.getGeofenceSetupStatus(req.tenantId!);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function getCrossCheckFlags(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await geofenceService.getCrossCheckFlags(req.tenantId!, req.query as never);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function resolveCrossCheckFlag(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await geofenceService.resolveCrossCheckFlag(
      req.params.id, req.tenantId!, req.body,
    );
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}
