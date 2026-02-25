import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerQuerySchema,
  customerParamsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// All customer routes require auth + tenant scoping
router.use('/v1/customers', authenticate, tenantScope);

// Stats must be before :id to avoid matching "stats" as UUID
router.get(
  '/v1/customers/stats',
  requireRole('owner', 'div_mgr'),
  ctrl.getStats,
);

router.get(
  '/v1/customers',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(customerQuerySchema, 'query'),
  ctrl.listCustomers,
);

router.get(
  '/v1/customers/:id',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(customerParamsSchema, 'params'),
  ctrl.getCustomer,
);

router.post(
  '/v1/customers',
  requireRole('owner', 'coordinator'),
  validate(createCustomerSchema),
  ctrl.createCustomer,
);

router.put(
  '/v1/customers/:id',
  requireRole('owner', 'coordinator'),
  validate(customerParamsSchema, 'params'),
  validate(updateCustomerSchema),
  ctrl.updateCustomer,
);

router.delete(
  '/v1/customers/:id',
  requireRole('owner'),
  validate(customerParamsSchema, 'params'),
  ctrl.deleteCustomer,
);

export default router;
