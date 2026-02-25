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

export default router;
