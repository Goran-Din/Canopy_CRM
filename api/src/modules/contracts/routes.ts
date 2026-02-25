import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createContractSchema,
  updateContractSchema,
  statusChangeSchema,
  contractQuerySchema,
  contractParamsSchema,
  createLineItemSchema,
  updateLineItemSchema,
  lineItemParamsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// All contract routes require auth + tenant scoping
router.use('/v1/contracts', authenticate, tenantScope);

// Stats must be before :id
router.get(
  '/v1/contracts/stats',
  requireRole('owner', 'div_mgr'),
  ctrl.getStats,
);

// Line item routes with lineItemId (before :id to avoid collision)
router.put(
  '/v1/contracts/line-items/:lineItemId',
  requireRole('owner', 'coordinator'),
  validate(lineItemParamsSchema, 'params'),
  validate(updateLineItemSchema),
  ctrl.updateLineItem,
);

router.delete(
  '/v1/contracts/line-items/:lineItemId',
  requireRole('owner', 'coordinator'),
  validate(lineItemParamsSchema, 'params'),
  ctrl.removeLineItem,
);

// Contract CRUD
router.get(
  '/v1/contracts',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(contractQuerySchema, 'query'),
  ctrl.listContracts,
);

router.get(
  '/v1/contracts/:id',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(contractParamsSchema, 'params'),
  ctrl.getContract,
);

router.post(
  '/v1/contracts',
  requireRole('owner', 'coordinator'),
  validate(createContractSchema),
  ctrl.createContract,
);

router.put(
  '/v1/contracts/:id',
  requireRole('owner', 'coordinator'),
  validate(contractParamsSchema, 'params'),
  validate(updateContractSchema),
  ctrl.updateContract,
);

router.patch(
  '/v1/contracts/:id/status',
  requireRole('owner', 'coordinator'),
  validate(contractParamsSchema, 'params'),
  validate(statusChangeSchema),
  ctrl.changeStatus,
);

router.delete(
  '/v1/contracts/:id',
  requireRole('owner'),
  validate(contractParamsSchema, 'params'),
  ctrl.deleteContract,
);

// Line items for a specific contract
router.get(
  '/v1/contracts/:id/line-items',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(contractParamsSchema, 'params'),
  ctrl.getLineItems,
);

router.post(
  '/v1/contracts/:id/line-items',
  requireRole('owner', 'coordinator'),
  validate(contractParamsSchema, 'params'),
  validate(createLineItemSchema),
  ctrl.addLineItem,
);

export default router;
