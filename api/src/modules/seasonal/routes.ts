import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createSeasonalSchema,
  updateSeasonalSchema,
  updateChecklistSchema,
  seasonalQuerySchema,
  seasonalParamsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

router.use('/v1/seasonal', authenticate, tenantScope);

router.get(
  '/v1/seasonal',
  requireRole('owner', 'div_mgr'),
  validate(seasonalQuerySchema, 'query'),
  ctrl.listTransitions,
);

router.get(
  '/v1/seasonal/:id',
  requireRole('owner', 'div_mgr'),
  validate(seasonalParamsSchema, 'params'),
  ctrl.getTransition,
);

router.post(
  '/v1/seasonal',
  requireRole('owner', 'div_mgr'),
  validate(createSeasonalSchema),
  ctrl.createTransition,
);

router.put(
  '/v1/seasonal/:id',
  requireRole('owner', 'div_mgr'),
  validate(seasonalParamsSchema, 'params'),
  validate(updateSeasonalSchema),
  ctrl.updateTransition,
);

router.patch(
  '/v1/seasonal/:id/checklist',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(seasonalParamsSchema, 'params'),
  validate(updateChecklistSchema),
  ctrl.updateChecklist,
);

router.delete(
  '/v1/seasonal/:id',
  requireRole('owner'),
  validate(seasonalParamsSchema, 'params'),
  ctrl.deleteTransition,
);

export default router;
