import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  generateOccurrencesSchema,
  assignOccurrenceSchema,
  bulkAssignSchema,
  skipOccurrenceSchema,
  occurrenceQuerySchema,
  serviceListQuerySchema,
  serviceDetailQuerySchema,
  occurrenceIdParamsSchema,
  contractIdParamsSchema,
  serviceCodeParamsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// All routes require auth + tenant
router.use('/v1/service-lists', authenticate, tenantScope);
router.use('/v1/service-occurrences', authenticate, tenantScope);

// Service Lists (coordinator operational view)
router.get(
  '/v1/service-lists',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(serviceListQuerySchema, 'query'),
  ctrl.getServiceListSummary,
);

router.get(
  '/v1/service-lists/:serviceCode',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(serviceCodeParamsSchema, 'params'),
  validate(serviceDetailQuerySchema, 'query'),
  ctrl.getServiceDetail,
);

// Occurrences — static routes before :id
router.get(
  '/v1/service-occurrences/season-summary',
  validate(serviceListQuerySchema, 'query'),
  ctrl.getSeasonSummary,
);

// Bulk assign (static route before :id)
router.post(
  '/v1/service-occurrences/bulk-assign',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(bulkAssignSchema),
  ctrl.bulkAssign,
);

// Occurrences CRUD
router.get(
  '/v1/service-occurrences',
  validate(occurrenceQuerySchema, 'query'),
  ctrl.listOccurrences,
);

router.get(
  '/v1/service-occurrences/:id',
  validate(occurrenceIdParamsSchema, 'params'),
  ctrl.getOccurrence,
);

// Assignment
router.patch(
  '/v1/service-occurrences/:id/assign',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(occurrenceIdParamsSchema, 'params'),
  validate(assignOccurrenceSchema),
  ctrl.assignOccurrence,
);

// Skip / Complete
router.patch(
  '/v1/service-occurrences/:id/skip',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(occurrenceIdParamsSchema, 'params'),
  validate(skipOccurrenceSchema),
  ctrl.skipOccurrence,
);

router.patch(
  '/v1/service-occurrences/:id/complete',
  validate(occurrenceIdParamsSchema, 'params'),
  ctrl.markCompleted,
);

// Season setup (generates occurrences from contract)
router.post(
  '/v1/contracts/:contractId/season-setup',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(contractIdParamsSchema, 'params'),
  validate(generateOccurrencesSchema),
  ctrl.generateOccurrences,
);

export default router;
