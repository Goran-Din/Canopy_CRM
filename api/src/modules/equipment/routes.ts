import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createEquipmentSchema,
  updateEquipmentSchema,
  equipmentQuerySchema,
  equipmentParamsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

router.use('/v1/equipment', authenticate, tenantScope);

router.get(
  '/v1/equipment',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(equipmentQuerySchema, 'query'),
  ctrl.list,
);

router.get(
  '/v1/equipment/:id',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(equipmentParamsSchema, 'params'),
  ctrl.get,
);

router.post(
  '/v1/equipment',
  requireRole('owner', 'div_mgr'),
  validate(createEquipmentSchema),
  ctrl.create,
);

router.put(
  '/v1/equipment/:id',
  requireRole('owner', 'div_mgr'),
  validate(equipmentParamsSchema, 'params'),
  validate(updateEquipmentSchema),
  ctrl.update,
);

router.delete(
  '/v1/equipment/:id',
  requireRole('owner'),
  validate(equipmentParamsSchema, 'params'),
  ctrl.remove,
);

export default router;
