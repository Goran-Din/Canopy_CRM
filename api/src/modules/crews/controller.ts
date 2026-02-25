import type { Request, Response, NextFunction } from 'express';
import * as crewService from './service.js';

// ======== CREWS ========

export async function listCrews(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await crewService.listCrews(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function getCrew(req: Request, res: Response, next: NextFunction) {
  try {
    const crew = await crewService.getCrew(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: crew });
  } catch (err) {
    next(err);
  }
}

export async function createCrew(req: Request, res: Response, next: NextFunction) {
  try {
    const crew = await crewService.createCrew(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: crew });
  } catch (err) {
    next(err);
  }
}

export async function updateCrew(req: Request, res: Response, next: NextFunction) {
  try {
    const crew = await crewService.updateCrew(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data: crew });
  } catch (err) {
    next(err);
  }
}

export async function deleteCrew(req: Request, res: Response, next: NextFunction) {
  try {
    await crewService.deleteCrew(req.tenantId!, req.params.id);
    res.json({ status: 'success', message: 'Crew deleted' });
  } catch (err) {
    next(err);
  }
}

// --- Crew Members ---

export async function getCrewMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const members = await crewService.getCrewMembers(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: members });
  } catch (err) {
    next(err);
  }
}

export async function addCrewMember(req: Request, res: Response, next: NextFunction) {
  try {
    const member = await crewService.addCrewMember(req.tenantId!, req.params.id, req.body);
    res.status(201).json({ status: 'success', data: member });
  } catch (err) {
    next(err);
  }
}

export async function removeCrewMember(req: Request, res: Response, next: NextFunction) {
  try {
    await crewService.removeCrewMember(req.tenantId!, req.params.id, req.params.userId);
    res.json({ status: 'success', message: 'Member removed from crew' });
  } catch (err) {
    next(err);
  }
}

// ======== ROUTES ========

export async function listRoutes(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await crewService.listRoutes(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function getRoute(req: Request, res: Response, next: NextFunction) {
  try {
    const route = await crewService.getRoute(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: route });
  } catch (err) {
    next(err);
  }
}

export async function createRoute(req: Request, res: Response, next: NextFunction) {
  try {
    const route = await crewService.createRoute(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: route });
  } catch (err) {
    next(err);
  }
}

export async function updateRoute(req: Request, res: Response, next: NextFunction) {
  try {
    const route = await crewService.updateRoute(req.tenantId!, req.params.id, req.body, req.user!.id);
    res.json({ status: 'success', data: route });
  } catch (err) {
    next(err);
  }
}

export async function deleteRoute(req: Request, res: Response, next: NextFunction) {
  try {
    await crewService.deleteRoute(req.tenantId!, req.params.id);
    res.json({ status: 'success', message: 'Route deleted' });
  } catch (err) {
    next(err);
  }
}

// --- Route Stops ---

export async function getRouteStops(req: Request, res: Response, next: NextFunction) {
  try {
    const stops = await crewService.getRouteStops(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: stops });
  } catch (err) {
    next(err);
  }
}

export async function addStop(req: Request, res: Response, next: NextFunction) {
  try {
    const stop = await crewService.addStop(req.tenantId!, req.params.id, req.body);
    res.status(201).json({ status: 'success', data: stop });
  } catch (err) {
    next(err);
  }
}

export async function updateStop(req: Request, res: Response, next: NextFunction) {
  try {
    const stop = await crewService.updateStop(req.tenantId!, req.params.stopId, req.body);
    res.json({ status: 'success', data: stop });
  } catch (err) {
    next(err);
  }
}

export async function removeStop(req: Request, res: Response, next: NextFunction) {
  try {
    await crewService.removeStop(req.tenantId!, req.params.stopId);
    res.json({ status: 'success', message: 'Stop removed from route' });
  } catch (err) {
    next(err);
  }
}

export async function reorderStops(req: Request, res: Response, next: NextFunction) {
  try {
    const stops = await crewService.reorderStops(req.tenantId!, req.params.id, req.body);
    res.json({ status: 'success', data: stops });
  } catch (err) {
    next(err);
  }
}
