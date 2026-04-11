import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  submitFeedbackSchema,
  tokenParamsSchema,
  listFeedbackSchema,
  addStaffNoteSchema,
  feedbackIdParamsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// === Public routes (no auth — token-based access) ===

// GET /v1/feedback/page/:token — feedback page data
router.get('/v1/feedback/page/:token',
  validate(tokenParamsSchema, 'params'),
  ctrl.getFeedbackPage);

// POST /v1/feedback/submit — submit rating + comment
router.post('/v1/feedback/submit',
  validate(submitFeedbackSchema),
  ctrl.submitFeedback);

// POST /v1/feedback/:token/review-clicked — record Google Review click
router.post('/v1/feedback/:token/review-clicked',
  validate(tokenParamsSchema, 'params'),
  ctrl.recordReviewClick);

// === Staff routes (auth required) ===

// GET /v1/feedback/summary — aggregated stats
router.get('/v1/feedback/summary',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr'),
  ctrl.getFeedbackSummary);

// GET /v1/feedback — list all feedback
router.get('/v1/feedback',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr'),
  validate(listFeedbackSchema, 'query'),
  ctrl.listFeedback);

// PATCH /v1/feedback/:id/note — add staff note
router.patch('/v1/feedback/:id/note',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(feedbackIdParamsSchema, 'params'),
  validate(addStaffNoteSchema),
  ctrl.addStaffNote);

export default router;
