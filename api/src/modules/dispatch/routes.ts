import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import * as ctrl from './controller.js';
import { boardQuerySchema, assignJobSchema, rescheduleJobSchema, unassignJobSchema } from './schema.js';

const router = Router();

router.use('/v1/dispatch', authenticate, tenantScope);

router.get(
  '/v1/dispatch/board',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(boardQuerySchema, 'query'),
  ctrl.getBoard,
);

router.get(
  '/v1/dispatch/queue',
  requireRole('owner', 'div_mgr', 'coordinator'),
  ctrl.getQueue,
);

router.patch(
  '/v1/dispatch/assign',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(assignJobSchema),
  ctrl.assignJob,
);

router.patch(
  '/v1/dispatch/reschedule',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(rescheduleJobSchema),
  ctrl.rescheduleJob,
);

router.patch(
  '/v1/dispatch/unassign',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(unassignJobSchema),
  ctrl.unassignJob,
);

export default router;
