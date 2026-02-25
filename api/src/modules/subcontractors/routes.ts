import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createSubcontractorSchema,
  updateSubcontractorSchema,
  subcontractorQuerySchema,
  subcontractorParamsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

router.use('/v1/subcontractors', authenticate, tenantScope);

router.get(
  '/v1/subcontractors',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(subcontractorQuerySchema, 'query'),
  ctrl.list,
);

router.get(
  '/v1/subcontractors/:id',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(subcontractorParamsSchema, 'params'),
  ctrl.get,
);

router.post(
  '/v1/subcontractors',
  requireRole('owner', 'div_mgr'),
  validate(createSubcontractorSchema),
  ctrl.create,
);

router.put(
  '/v1/subcontractors/:id',
  requireRole('owner', 'div_mgr'),
  validate(subcontractorParamsSchema, 'params'),
  validate(updateSubcontractorSchema),
  ctrl.update,
);

router.delete(
  '/v1/subcontractors/:id',
  requireRole('owner'),
  validate(subcontractorParamsSchema, 'params'),
  ctrl.remove,
);

export default router;
