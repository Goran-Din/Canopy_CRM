import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenant.js';
import { requireRole } from '../../middleware/rbac.js';
import * as ctrl from './controller.js';

const router = Router();

router.get('/v1/command-center/summary',
  authenticate,
  tenantScope,
  requireRole('owner'),
  ctrl.getCommandCenterSummary);

export default router;
