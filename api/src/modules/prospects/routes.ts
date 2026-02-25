import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createProspectSchema,
  updateProspectSchema,
  prospectStatusSchema,
  prospectQuerySchema,
  prospectParamsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

router.use('/v1/prospects', authenticate, tenantScope);

// Static routes first
router.get(
  '/v1/prospects/pipeline',
  requireRole('owner', 'div_mgr'),
  ctrl.pipelineStats,
);

router.get(
  '/v1/prospects',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(prospectQuerySchema, 'query'),
  ctrl.list,
);

router.get(
  '/v1/prospects/:id',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(prospectParamsSchema, 'params'),
  ctrl.get,
);

router.post(
  '/v1/prospects',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(createProspectSchema),
  ctrl.create,
);

router.put(
  '/v1/prospects/:id',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(prospectParamsSchema, 'params'),
  validate(updateProspectSchema),
  ctrl.update,
);

router.patch(
  '/v1/prospects/:id/status',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(prospectParamsSchema, 'params'),
  validate(prospectStatusSchema),
  ctrl.changeStatus,
);

router.delete(
  '/v1/prospects/:id',
  requireRole('owner'),
  validate(prospectParamsSchema, 'params'),
  ctrl.remove,
);

export default router;
