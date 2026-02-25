import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  clockInSchema,
  clockOutSchema,
  updateEntrySchema,
  entryQuerySchema,
  entryParamsSchema,
  timesheetQuerySchema,
  dailySummaryQuerySchema,
  weeklySummaryQuerySchema,
  createGpsEventSchema,
  gpsJobParamsSchema,
  gpsUserParamsSchema,
  gpsUserQuerySchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// All time-tracking routes require auth + tenant scoping
router.use('/v1/time-entries', authenticate, tenantScope);
router.use('/v1/gps-events', authenticate, tenantScope);

// ======== TIME ENTRIES ========

// Static routes before :id to avoid collision
router.get(
  '/v1/time-entries/my-timesheet',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader', 'crew_member'),
  validate(timesheetQuerySchema, 'query'),
  ctrl.getMyTimesheet,
);

router.get(
  '/v1/time-entries/daily-summary',
  requireRole('owner', 'div_mgr', 'crew_leader'),
  validate(dailySummaryQuerySchema, 'query'),
  ctrl.getDailySummary,
);

router.get(
  '/v1/time-entries/weekly-summary',
  requireRole('owner', 'div_mgr'),
  validate(weeklySummaryQuerySchema, 'query'),
  ctrl.getWeeklySummary,
);

router.post(
  '/v1/time-entries/clock-in',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader', 'crew_member'),
  validate(clockInSchema),
  ctrl.clockIn,
);

// Entry CRUD
router.get(
  '/v1/time-entries',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(entryQuerySchema, 'query'),
  ctrl.listEntries,
);

router.get(
  '/v1/time-entries/:id',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(entryParamsSchema, 'params'),
  ctrl.getEntry,
);

router.post(
  '/v1/time-entries/:id/clock-out',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader', 'crew_member'),
  validate(entryParamsSchema, 'params'),
  validate(clockOutSchema),
  ctrl.clockOut,
);

router.put(
  '/v1/time-entries/:id',
  requireRole('owner', 'div_mgr'),
  validate(entryParamsSchema, 'params'),
  validate(updateEntrySchema),
  ctrl.updateEntry,
);

router.post(
  '/v1/time-entries/:id/approve',
  requireRole('owner', 'div_mgr'),
  validate(entryParamsSchema, 'params'),
  ctrl.approveEntry,
);

// ======== GPS EVENTS ========

// Static routes before parameterized
router.get(
  '/v1/gps-events/by-job/:jobId',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(gpsJobParamsSchema, 'params'),
  ctrl.getGpsEventsByJob,
);

router.get(
  '/v1/gps-events/by-user/:userId',
  requireRole('owner', 'div_mgr'),
  validate(gpsUserParamsSchema, 'params'),
  validate(gpsUserQuerySchema, 'query'),
  ctrl.getGpsEventsByUser,
);

router.get(
  '/v1/gps-events/latest/:userId',
  requireRole('owner', 'div_mgr', 'crew_leader'),
  validate(gpsUserParamsSchema, 'params'),
  ctrl.getLatestGpsByUser,
);

router.post(
  '/v1/gps-events',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader', 'crew_member'),
  validate(createGpsEventSchema),
  ctrl.recordGpsEvent,
);

export default router;
