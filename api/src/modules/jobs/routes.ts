import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createJobSchema,
  updateJobSchema,
  jobStatusChangeSchema,
  jobQuerySchema,
  scheduleQuerySchema,
  jobParamsSchema,
  propertyParamsSchema,
  checklistItemParamsSchema,
  createPhotoSchema,
  createChecklistSchema,
  updateChecklistSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// All job routes require auth + tenant scoping
router.use('/v1/jobs', authenticate, tenantScope);

// Static routes before :id to avoid collision
router.get(
  '/v1/jobs/stats',
  requireRole('owner', 'div_mgr'),
  ctrl.getStats,
);

router.get(
  '/v1/jobs/schedule',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(scheduleQuerySchema, 'query'),
  ctrl.getSchedule,
);

router.get(
  '/v1/jobs/by-property/:propertyId',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(propertyParamsSchema, 'params'),
  ctrl.getJobsByProperty,
);

// Checklist item update (before :id routes)
router.put(
  '/v1/jobs/checklist/:itemId',
  requireRole('owner', 'coordinator', 'crew_leader', 'crew_member'),
  validate(checklistItemParamsSchema, 'params'),
  validate(updateChecklistSchema),
  ctrl.updateChecklistItem,
);

// Job CRUD
router.get(
  '/v1/jobs',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(jobQuerySchema, 'query'),
  ctrl.listJobs,
);

router.get(
  '/v1/jobs/:id',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader'),
  validate(jobParamsSchema, 'params'),
  ctrl.getJob,
);

router.post(
  '/v1/jobs',
  requireRole('owner', 'coordinator'),
  validate(createJobSchema),
  ctrl.createJob,
);

router.put(
  '/v1/jobs/:id',
  requireRole('owner', 'coordinator'),
  validate(jobParamsSchema, 'params'),
  validate(updateJobSchema),
  ctrl.updateJob,
);

router.patch(
  '/v1/jobs/:id/status',
  requireRole('owner', 'coordinator', 'crew_leader'),
  validate(jobParamsSchema, 'params'),
  validate(jobStatusChangeSchema),
  ctrl.changeStatus,
);

router.delete(
  '/v1/jobs/:id',
  requireRole('owner'),
  validate(jobParamsSchema, 'params'),
  ctrl.deleteJob,
);

// Photos
router.post(
  '/v1/jobs/:id/photos',
  requireRole('owner', 'coordinator', 'crew_leader', 'crew_member'),
  validate(jobParamsSchema, 'params'),
  validate(createPhotoSchema),
  ctrl.addPhoto,
);

router.get(
  '/v1/jobs/:id/photos',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader', 'crew_member'),
  validate(jobParamsSchema, 'params'),
  ctrl.getPhotos,
);

// Checklist
router.post(
  '/v1/jobs/:id/checklist',
  requireRole('owner', 'coordinator'),
  validate(jobParamsSchema, 'params'),
  validate(createChecklistSchema),
  ctrl.addChecklistItem,
);

router.get(
  '/v1/jobs/:id/checklist',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader', 'crew_member'),
  validate(jobParamsSchema, 'params'),
  ctrl.getChecklist,
);

export default router;
