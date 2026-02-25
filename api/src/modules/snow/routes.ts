import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createSeasonSchema,
  updateSeasonSchema,
  seasonQuerySchema,
  seasonParamsSchema,
  createRunSchema,
  updateRunSchema,
  runStatusSchema,
  runQuerySchema,
  runParamsSchema,
  createEntrySchema,
  updateEntrySchema,
  entryStatusSchema,
  entryParamsSchema,
  runEntryParamsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// All snow routes require auth + tenant scoping
router.use('/v1/snow', authenticate, tenantScope);

// --- Stats (static route before :id) ---
router.get(
  '/v1/snow/stats',
  requireRole('owner', 'div_mgr'),
  ctrl.getStats,
);

// --- Seasons ---
router.get(
  '/v1/snow/seasons',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(seasonQuerySchema, 'query'),
  ctrl.listSeasons,
);

router.get(
  '/v1/snow/seasons/:id',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(seasonParamsSchema, 'params'),
  ctrl.getSeason,
);

router.post(
  '/v1/snow/seasons',
  requireRole('owner'),
  validate(createSeasonSchema),
  ctrl.createSeason,
);

router.put(
  '/v1/snow/seasons/:id',
  requireRole('owner'),
  validate(seasonParamsSchema, 'params'),
  validate(updateSeasonSchema),
  ctrl.updateSeason,
);

router.delete(
  '/v1/snow/seasons/:id',
  requireRole('owner'),
  validate(seasonParamsSchema, 'params'),
  ctrl.deleteSeason,
);

// --- Entry routes with entryId (before run :id to avoid collision) ---
router.put(
  '/v1/snow/entries/:entryId',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(entryParamsSchema, 'params'),
  validate(updateEntrySchema),
  ctrl.updateEntry,
);

router.patch(
  '/v1/snow/entries/:entryId/status',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader', 'crew_member'),
  validate(entryParamsSchema, 'params'),
  validate(entryStatusSchema),
  ctrl.changeEntryStatus,
);

// --- Runs ---
router.get(
  '/v1/snow/runs',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(runQuerySchema, 'query'),
  ctrl.listRuns,
);

router.get(
  '/v1/snow/runs/:id',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(runParamsSchema, 'params'),
  ctrl.getRun,
);

router.post(
  '/v1/snow/runs',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(createRunSchema),
  ctrl.createRun,
);

router.put(
  '/v1/snow/runs/:id',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(runParamsSchema, 'params'),
  validate(updateRunSchema),
  ctrl.updateRun,
);

router.patch(
  '/v1/snow/runs/:id/status',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(runParamsSchema, 'params'),
  validate(runStatusSchema),
  ctrl.changeRunStatus,
);

// --- Run entries (nested under run :id) ---
router.post(
  '/v1/snow/runs/:id/entries',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(runEntryParamsSchema, 'params'),
  validate(createEntrySchema),
  ctrl.addEntry,
);

router.post(
  '/v1/snow/runs/:id/bulk-entries',
  requireRole('owner', 'coordinator'),
  validate(runEntryParamsSchema, 'params'),
  ctrl.bulkCreateEntries,
);

export default router;
