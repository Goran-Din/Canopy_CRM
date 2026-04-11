import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  generateDraftsSchema,
  updateDraftSchema,
  rejectDraftSchema,
  draftQuerySchema,
  scheduleQuerySchema,
  draftIdParamsSchema,
  milestoneIdParamsSchema,
  jobIdParamsSchema,
  setupMilestonesSchema,
  addMilestoneSchema,
  updateMilestoneSchema,
  cancelMilestoneSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// All billing routes require auth + tenant
router.use('/v1/billing', authenticate, tenantScope);

// Dashboard
router.get('/v1/billing/dashboard', requireRole('owner', 'div_mgr'), ctrl.getDashboard);

// Drafts
router.get('/v1/billing/drafts',
  requireRole('owner', 'div_mgr'),
  validate(draftQuerySchema, 'query'),
  ctrl.listDrafts);

router.get('/v1/billing/drafts/:id',
  requireRole('owner', 'div_mgr'),
  validate(draftIdParamsSchema, 'params'),
  ctrl.getDraft);

router.patch('/v1/billing/drafts/:id',
  requireRole('owner'),
  validate(draftIdParamsSchema, 'params'),
  validate(updateDraftSchema),
  ctrl.updateDraft);

router.post('/v1/billing/drafts/:id/approve',
  requireRole('owner'),
  validate(draftIdParamsSchema, 'params'),
  ctrl.approveDraft);

router.post('/v1/billing/drafts/:id/reject',
  requireRole('owner'),
  validate(draftIdParamsSchema, 'params'),
  validate(rejectDraftSchema),
  ctrl.rejectDraft);

// Generation & Schedule
router.post('/v1/billing/generate-drafts',
  requireRole('owner'),
  validate(generateDraftsSchema),
  ctrl.manualGenerateDrafts);

router.get('/v1/billing/schedule',
  requireRole('owner', 'div_mgr'),
  validate(scheduleQuerySchema, 'query'),
  ctrl.listSchedule);

router.get('/v1/billing/overdue',
  requireRole('owner', 'div_mgr'),
  ctrl.listOverdue);

// Milestones (existing trigger route)
router.post('/v1/billing/milestones/:id/trigger',
  requireRole('owner'),
  validate(milestoneIdParamsSchema, 'params'),
  ctrl.triggerMilestone);

// Hardscape summary
router.get('/v1/billing/hardscape-summary',
  requireRole('owner', 'div_mgr'),
  ctrl.getHardscapeSummary);

// === Milestone CRUD routes (outside /v1/billing prefix) ===

// GET /v1/jobs/:id/milestones — list milestones with financial summary
router.get('/v1/jobs/:id/milestones',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(jobIdParamsSchema, 'params'),
  ctrl.listMilestones);

// POST /v1/jobs/:id/milestones/setup — create initial billing plan
router.post('/v1/jobs/:id/milestones/setup',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr'),
  validate(jobIdParamsSchema, 'params'),
  validate(setupMilestonesSchema),
  ctrl.setupMilestones);

// POST /v1/jobs/:id/milestones — add single milestone
router.post('/v1/jobs/:id/milestones',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr'),
  validate(jobIdParamsSchema, 'params'),
  validate(addMilestoneSchema),
  ctrl.addMilestone);

// PATCH /v1/milestones/:id — update pending milestone
router.patch('/v1/milestones/:id',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr'),
  validate(milestoneIdParamsSchema, 'params'),
  validate(updateMilestoneSchema),
  ctrl.updateMilestone);

// POST /v1/milestones/:id/generate-invoice — generate invoice draft
router.post('/v1/milestones/:id/generate-invoice',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr'),
  validate(milestoneIdParamsSchema, 'params'),
  ctrl.generateMilestoneInvoice);

// POST /v1/milestones/:id/cancel — cancel pending milestone
router.post('/v1/milestones/:id/cancel',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr'),
  validate(milestoneIdParamsSchema, 'params'),
  validate(cancelMilestoneSchema),
  ctrl.cancelMilestone);

export default router;
