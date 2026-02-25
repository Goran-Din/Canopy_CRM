import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createMaterialSchema,
  updateMaterialSchema,
  materialQuerySchema,
  materialParamsSchema,
  createTransactionSchema,
  transactionQuerySchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

router.use('/v1/materials', authenticate, tenantScope);

// Static routes first
router.get(
  '/v1/materials/low-stock',
  requireRole('owner', 'div_mgr', 'coordinator'),
  ctrl.lowStock,
);

router.get(
  '/v1/materials',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(materialQuerySchema, 'query'),
  ctrl.list,
);

router.get(
  '/v1/materials/:id',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(materialParamsSchema, 'params'),
  ctrl.get,
);

router.post(
  '/v1/materials',
  requireRole('owner', 'div_mgr'),
  validate(createMaterialSchema),
  ctrl.create,
);

router.put(
  '/v1/materials/:id',
  requireRole('owner', 'div_mgr'),
  validate(materialParamsSchema, 'params'),
  validate(updateMaterialSchema),
  ctrl.update,
);

router.delete(
  '/v1/materials/:id',
  requireRole('owner'),
  validate(materialParamsSchema, 'params'),
  ctrl.remove,
);

// Material transactions
router.get(
  '/v1/materials/:id/transactions',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(materialParamsSchema, 'params'),
  validate(transactionQuerySchema, 'query'),
  ctrl.listTransactions,
);

router.post(
  '/v1/materials/:id/transactions',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(materialParamsSchema, 'params'),
  validate(createTransactionSchema),
  ctrl.recordTransaction,
);

export default router;
