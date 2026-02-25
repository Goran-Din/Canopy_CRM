import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createTemplateSchema,
  updateTemplateSchema,
  templateQuerySchema,
  templateParamsSchema,
  createStepSchema,
  updateStepSchema,
  stepParamsSchema,
  reorderStepsSchema,
  createAssignmentSchema,
  assignmentQuerySchema,
  assignmentParamsSchema,
  assignmentStatusSchema,
  completeStepParamsSchema,
  completeStepSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// All SOP routes require auth + tenant scoping
router.use('/v1/sops', authenticate, tenantScope);

// ======== Step routes with :stepId (before template :id to avoid collision) ========
router.put(
  '/v1/sops/steps/:stepId',
  requireRole('owner', 'div_mgr'),
  validate(stepParamsSchema, 'params'),
  validate(updateStepSchema),
  ctrl.updateStep,
);

router.delete(
  '/v1/sops/steps/:stepId',
  requireRole('owner', 'div_mgr'),
  validate(stepParamsSchema, 'params'),
  ctrl.deleteStep,
);

// ======== Assignment routes ========
router.get(
  '/v1/sops/assignments',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(assignmentQuerySchema, 'query'),
  ctrl.listAssignments,
);

router.get(
  '/v1/sops/assignments/:id',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader', 'crew_member'),
  validate(assignmentParamsSchema, 'params'),
  ctrl.getAssignment,
);

router.post(
  '/v1/sops/assignments',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(createAssignmentSchema),
  ctrl.createAssignment,
);

router.patch(
  '/v1/sops/assignments/:id/status',
  requireRole('owner', 'coordinator', 'crew_leader'),
  validate(assignmentParamsSchema, 'params'),
  validate(assignmentStatusSchema),
  ctrl.updateAssignmentStatus,
);

// Step completion route (assignment + step composite)
router.post(
  '/v1/sops/assignments/:assignmentId/steps/:stepId/complete',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader', 'crew_member'),
  validate(completeStepParamsSchema, 'params'),
  validate(completeStepSchema),
  ctrl.completeStepAction,
);

// ======== Template routes ========
router.get(
  '/v1/sops/templates',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(templateQuerySchema, 'query'),
  ctrl.listTemplates,
);

router.get(
  '/v1/sops/templates/:id',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(templateParamsSchema, 'params'),
  ctrl.getTemplate,
);

router.post(
  '/v1/sops/templates',
  requireRole('owner', 'div_mgr'),
  validate(createTemplateSchema),
  ctrl.createTemplate,
);

router.put(
  '/v1/sops/templates/:id',
  requireRole('owner', 'div_mgr'),
  validate(templateParamsSchema, 'params'),
  validate(updateTemplateSchema),
  ctrl.updateTemplate,
);

router.delete(
  '/v1/sops/templates/:id',
  requireRole('owner'),
  validate(templateParamsSchema, 'params'),
  ctrl.deleteTemplate,
);

router.post(
  '/v1/sops/templates/:id/duplicate',
  requireRole('owner', 'div_mgr'),
  validate(templateParamsSchema, 'params'),
  ctrl.duplicateTemplate,
);

// ======== Template step management ========
router.post(
  '/v1/sops/templates/:id/steps',
  requireRole('owner', 'div_mgr'),
  validate(templateParamsSchema, 'params'),
  validate(createStepSchema),
  ctrl.addStep,
);

router.put(
  '/v1/sops/templates/:id/steps/reorder',
  requireRole('owner', 'div_mgr'),
  validate(templateParamsSchema, 'params'),
  validate(reorderStepsSchema),
  ctrl.reorderSteps,
);

export default router;
