import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createTemplateSchema,
  updateTemplateSchema,
  listTemplatesSchema,
  loadTemplateSchema,
  saveFromQuoteSchema,
  updateAutomationConfigSchema,
  templateIdParamsSchema,
  quoteIdParamsSchema,
  automationTypeParamsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// === Static routes first (before :id params) ===

// POST /v1/templates/save-from-quote — Owner, Div Mgr, Coordinator
router.post(
  '/v1/templates/save-from-quote',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(saveFromQuoteSchema),
  ctrl.saveFromQuote,
);

// GET /v1/templates/automations — Owner, Div Mgr
router.get(
  '/v1/templates/automations',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr'),
  ctrl.listAutomationTemplates,
);

// PATCH /v1/templates/automations/:type/config — Owner
router.patch(
  '/v1/templates/automations/:type/config',
  authenticate,
  tenantScope,
  requireRole('owner'),
  validate(automationTypeParamsSchema, 'params'),
  validate(updateAutomationConfigSchema),
  ctrl.updateAutomationConfig,
);

// === CRUD ===

// GET /v1/templates — All staff
router.get(
  '/v1/templates',
  authenticate,
  tenantScope,
  validate(listTemplatesSchema, 'query'),
  ctrl.listTemplates,
);

// GET /v1/templates/:id — All staff
router.get(
  '/v1/templates/:id',
  authenticate,
  tenantScope,
  validate(templateIdParamsSchema, 'params'),
  ctrl.getTemplate,
);

// POST /v1/templates — Owner, Div Mgr
router.post(
  '/v1/templates',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr'),
  validate(createTemplateSchema),
  ctrl.createTemplate,
);

// PATCH /v1/templates/:id — Owner, Div Mgr
router.patch(
  '/v1/templates/:id',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr'),
  validate(templateIdParamsSchema, 'params'),
  validate(updateTemplateSchema),
  ctrl.updateTemplate,
);

// DELETE /v1/templates/:id — Owner
router.delete(
  '/v1/templates/:id',
  authenticate,
  tenantScope,
  requireRole('owner'),
  validate(templateIdParamsSchema, 'params'),
  ctrl.deleteTemplate,
);

// === Quote Integration ===

// POST /v1/quotes/:id/load-template — Owner, Div Mgr, Coordinator
router.post(
  '/v1/quotes/:id/load-template',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(quoteIdParamsSchema, 'params'),
  validate(loadTemplateSchema),
  ctrl.loadTemplateIntoQuote,
);

export default router;
