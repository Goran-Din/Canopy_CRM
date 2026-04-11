import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  updateConfigSchema,
  listLogsSchema,
  testSendSchema,
  automationTypeParamsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// All automation routes require auth + tenant
router.use('/v1/automations', authenticate, tenantScope);

// GET /v1/automations/configs — Owner, Div Mgr
router.get('/v1/automations/configs',
  requireRole('owner', 'div_mgr'),
  ctrl.listConfigs);

// GET /v1/automations/configs/:type — Owner, Div Mgr
router.get('/v1/automations/configs/:type',
  requireRole('owner', 'div_mgr'),
  validate(automationTypeParamsSchema, 'params'),
  ctrl.getConfig);

// PATCH /v1/automations/configs/:type — Owner
router.patch('/v1/automations/configs/:type',
  requireRole('owner'),
  validate(automationTypeParamsSchema, 'params'),
  validate(updateConfigSchema),
  ctrl.updateConfig);

// GET /v1/automations/log — Owner, Div Mgr
router.get('/v1/automations/log',
  requireRole('owner', 'div_mgr'),
  validate(listLogsSchema, 'query'),
  ctrl.listLogs);

// POST /v1/automations/test-send — Owner
router.post('/v1/automations/test-send',
  requireRole('owner'),
  validate(testSendSchema),
  ctrl.testSend);

export default router;
