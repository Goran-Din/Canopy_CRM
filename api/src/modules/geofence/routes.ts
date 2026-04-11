import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  gpsEventSchema,
  updateGeofenceSchema,
  resolveFlagSchema,
  propertyEventsSchema,
  crossCheckFlagsSchema,
  propertyIdParamsSchema,
  jobIdParamsSchema,
  eventIdParamsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// === GPS Events ===

// POST /v1/gps-events — record GPS event (V2 with geofence fields)
router.post('/v1/gps-events/v2',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader', 'crew_member'),
  validate(gpsEventSchema),
  ctrl.recordGpsEvent);

// GET /v1/gps-events/live-crew-positions
router.get('/v1/gps-events/live-crew-positions',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  ctrl.getLiveCrewPositions);

// GET /v1/gps-events/by-job/:jobId
router.get('/v1/gps-events/v2/by-job/:jobId',
  authenticate,
  tenantScope,
  validate(jobIdParamsSchema, 'params'),
  ctrl.getEventsByJob);

// GET /v1/gps-events/by-property/:propertyId
router.get('/v1/gps-events/v2/by-property/:propertyId',
  authenticate,
  tenantScope,
  validate(propertyEventsSchema, 'query'),
  ctrl.getEventsByProperty);

// GET /v1/gps-events/cross-check-flags
router.get('/v1/gps-events/cross-check-flags',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr'),
  validate(crossCheckFlagsSchema, 'query'),
  ctrl.getCrossCheckFlags);

// POST /v1/gps-events/cross-check-flags/:id/resolve
router.post('/v1/gps-events/cross-check-flags/:id/resolve',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr'),
  validate(eventIdParamsSchema, 'params'),
  validate(resolveFlagSchema),
  ctrl.resolveCrossCheckFlag);

// === Today Office Properties ===

// GET /v1/geofence/today-office-properties
router.get('/v1/geofence/today-office-properties',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  ctrl.getTodayOfficeProperties);

// === Property Geofence ===

// GET /v1/properties/:id/geofence
router.get('/v1/properties/:id/geofence',
  authenticate,
  tenantScope,
  validate(propertyIdParamsSchema, 'params'),
  ctrl.getPropertyGeofence);

// PATCH /v1/properties/:id/geofence
router.patch('/v1/properties/:id/geofence',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(propertyIdParamsSchema, 'params'),
  validate(updateGeofenceSchema),
  ctrl.updatePropertyGeofence);

// GET /v1/properties/geofence-setup-status
router.get('/v1/properties/geofence-setup-status',
  authenticate,
  tenantScope,
  requireRole('owner', 'coordinator'),
  ctrl.getGeofenceSetupStatus);

export default router;
