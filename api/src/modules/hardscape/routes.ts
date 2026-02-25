import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createProjectSchema,
  updateProjectSchema,
  stageChangeSchema,
  projectQuerySchema,
  projectParamsSchema,
  createMilestoneSchema,
  updateMilestoneSchema,
  milestoneParamsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// All hardscape routes require auth + tenant scoping
router.use('/v1/hardscape', authenticate, tenantScope);

// --- Static routes before :id ---
router.get(
  '/v1/hardscape/pipeline',
  requireRole('owner', 'div_mgr'),
  ctrl.getPipelineStats,
);

// --- Milestone routes with milestoneId (before project :id to avoid collision) ---
router.put(
  '/v1/hardscape/milestones/:milestoneId',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(milestoneParamsSchema, 'params'),
  validate(updateMilestoneSchema),
  ctrl.updateMilestone,
);

// --- Projects ---
router.get(
  '/v1/hardscape/projects',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(projectQuerySchema, 'query'),
  ctrl.listProjects,
);

router.get(
  '/v1/hardscape/projects/:id',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(projectParamsSchema, 'params'),
  ctrl.getProject,
);

router.post(
  '/v1/hardscape/projects',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(createProjectSchema),
  ctrl.createProject,
);

router.put(
  '/v1/hardscape/projects/:id',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(projectParamsSchema, 'params'),
  validate(updateProjectSchema),
  ctrl.updateProject,
);

router.patch(
  '/v1/hardscape/projects/:id/stage',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(projectParamsSchema, 'params'),
  validate(stageChangeSchema),
  ctrl.changeStage,
);

router.delete(
  '/v1/hardscape/projects/:id',
  requireRole('owner'),
  validate(projectParamsSchema, 'params'),
  ctrl.deleteProject,
);

// --- Milestones (nested under project :id) ---
router.get(
  '/v1/hardscape/projects/:id/milestones',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(projectParamsSchema, 'params'),
  ctrl.listMilestones,
);

router.post(
  '/v1/hardscape/projects/:id/milestones',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(projectParamsSchema, 'params'),
  validate(createMilestoneSchema),
  ctrl.addMilestone,
);

// --- Stage History ---
router.get(
  '/v1/hardscape/projects/:id/history',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(projectParamsSchema, 'params'),
  ctrl.getStageHistory,
);

export default router;
