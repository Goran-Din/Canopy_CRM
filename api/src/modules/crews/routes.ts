import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createCrewSchema,
  updateCrewSchema,
  crewQuerySchema,
  crewParamsSchema,
  crewMemberSchema,
  memberParamsSchema,
  createRouteSchema,
  updateRouteSchema,
  routeQuerySchema,
  routeParamsSchema,
  createStopSchema,
  updateStopSchema,
  routeStopParamsSchema,
  reorderStopsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// All crew/route endpoints require auth + tenant scoping
router.use('/v1/crews', authenticate, tenantScope);
router.use('/v1/routes', authenticate, tenantScope);

// ======== CREWS ========

router.get(
  '/v1/crews',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(crewQuerySchema, 'query'),
  ctrl.listCrews,
);

router.get(
  '/v1/crews/:id',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(crewParamsSchema, 'params'),
  ctrl.getCrew,
);

router.post(
  '/v1/crews',
  requireRole('owner', 'div_mgr'),
  validate(createCrewSchema),
  ctrl.createCrew,
);

router.put(
  '/v1/crews/:id',
  requireRole('owner', 'div_mgr'),
  validate(crewParamsSchema, 'params'),
  validate(updateCrewSchema),
  ctrl.updateCrew,
);

router.delete(
  '/v1/crews/:id',
  requireRole('owner'),
  validate(crewParamsSchema, 'params'),
  ctrl.deleteCrew,
);

// --- Crew Members ---

router.get(
  '/v1/crews/:id/members',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(crewParamsSchema, 'params'),
  ctrl.getCrewMembers,
);

router.post(
  '/v1/crews/:id/members',
  requireRole('owner', 'div_mgr'),
  validate(crewParamsSchema, 'params'),
  validate(crewMemberSchema),
  ctrl.addCrewMember,
);

router.delete(
  '/v1/crews/:id/members/:userId',
  requireRole('owner', 'div_mgr'),
  validate(memberParamsSchema, 'params'),
  ctrl.removeCrewMember,
);

// ======== ROUTES ========

router.get(
  '/v1/routes',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(routeQuerySchema, 'query'),
  ctrl.listRoutes,
);

router.get(
  '/v1/routes/:id',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(routeParamsSchema, 'params'),
  ctrl.getRoute,
);

router.post(
  '/v1/routes',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(createRouteSchema),
  ctrl.createRoute,
);

router.put(
  '/v1/routes/:id',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(routeParamsSchema, 'params'),
  validate(updateRouteSchema),
  ctrl.updateRoute,
);

router.delete(
  '/v1/routes/:id',
  requireRole('owner', 'div_mgr'),
  validate(routeParamsSchema, 'params'),
  ctrl.deleteRoute,
);

// --- Route Stops ---

// Reorder must be before :stopId to avoid collision
router.put(
  '/v1/routes/:id/stops/reorder',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(routeParamsSchema, 'params'),
  validate(reorderStopsSchema),
  ctrl.reorderStops,
);

router.get(
  '/v1/routes/:id/stops',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(routeParamsSchema, 'params'),
  ctrl.getRouteStops,
);

router.post(
  '/v1/routes/:id/stops',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(routeParamsSchema, 'params'),
  validate(createStopSchema),
  ctrl.addStop,
);

router.put(
  '/v1/routes/:id/stops/:stopId',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(routeStopParamsSchema, 'params'),
  validate(updateStopSchema),
  ctrl.updateStop,
);

router.delete(
  '/v1/routes/:id/stops/:stopId',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(routeStopParamsSchema, 'params'),
  ctrl.removeStop,
);

export default router;
