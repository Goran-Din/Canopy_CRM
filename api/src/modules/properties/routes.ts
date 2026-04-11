import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createPropertySchema,
  updatePropertySchema,
  propertyQuerySchema,
  propertyParamsSchema,
  customerParamsSchema,
  updatePropertyProfileSchema,
  estimationQuerySchema,
  addCrewNoteSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// All property routes require auth + tenant scoping
router.use('/v1/properties', authenticate, tenantScope);

// Stats must be before :id to avoid matching "stats" as UUID
router.get(
  '/v1/properties/stats',
  requireRole('owner', 'div_mgr'),
  ctrl.getStats,
);

// Category summary (static route before :id)
router.get(
  '/v1/properties/categories/summary',
  ctrl.getCategorySummary,
);

// By-customer must be before :id to avoid matching "by-customer" as UUID
router.get(
  '/v1/properties/by-customer/:customerId',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(customerParamsSchema, 'params'),
  ctrl.getPropertiesByCustomer,
);

router.get(
  '/v1/properties',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(propertyQuerySchema, 'query'),
  ctrl.listProperties,
);

router.get(
  '/v1/properties/:id',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(propertyParamsSchema, 'params'),
  ctrl.getProperty,
);

router.post(
  '/v1/properties',
  requireRole('owner', 'coordinator'),
  validate(createPropertySchema),
  ctrl.createProperty,
);

router.put(
  '/v1/properties/:id',
  requireRole('owner', 'coordinator'),
  validate(propertyParamsSchema, 'params'),
  validate(updatePropertySchema),
  ctrl.updateProperty,
);

router.delete(
  '/v1/properties/:id',
  requireRole('owner'),
  validate(propertyParamsSchema, 'params'),
  ctrl.deleteProperty,
);

// ============================================
// V2 Routes — Property Knowledge Card
// ============================================

router.get(
  '/v1/properties/:id/knowledge-card',
  validate(propertyParamsSchema, 'params'),
  ctrl.getKnowledgeCard,
);

router.patch(
  '/v1/properties/:id/profile',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(propertyParamsSchema, 'params'),
  validate(updatePropertyProfileSchema),
  ctrl.updateProfile,
);

router.get(
  '/v1/properties/:id/service-history',
  validate(propertyParamsSchema, 'params'),
  ctrl.getServiceHistory,
);

router.get(
  '/v1/properties/:id/estimation-context',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(propertyParamsSchema, 'params'),
  validate(estimationQuerySchema, 'query'),
  ctrl.getEstimationContext,
);

router.get(
  '/v1/properties/:id/crew-notes',
  validate(propertyParamsSchema, 'params'),
  ctrl.getCrewNotes,
);

router.post(
  '/v1/properties/:id/crew-notes',
  validate(propertyParamsSchema, 'params'),
  validate(addCrewNoteSchema),
  ctrl.addCrewNote,
);

router.get(
  '/v1/properties/:id/photos',
  validate(propertyParamsSchema, 'params'),
  ctrl.getPropertyPhotos,
);

router.get(
  '/v1/properties/:id/job-history',
  validate(propertyParamsSchema, 'params'),
  ctrl.getJobHistory,
);

export default router;
