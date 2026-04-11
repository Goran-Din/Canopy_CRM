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
  createJobV2Schema,
  changeStatusSchema,
} from './schema.js';
import { addDiaryNoteSchema, diaryQuerySchema } from './diary/diary.schema.js';
import { addPhotoSchema as addPhotoV2Schema, updatePhotoSchema, photoParamsSchema } from './photos/photos.schema.js';
import { upsertBadgeSchema, assignBadgesSchema } from './badges/badges.schema.js';
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

// V2 Badges (static routes before :id)
router.get(
  '/v1/jobs/badges',
  requireRole('owner', 'div_mgr', 'coordinator'),
  ctrl.listBadges,
);

router.post(
  '/v1/jobs/badges',
  requireRole('owner', 'div_mgr'),
  validate(upsertBadgeSchema),
  ctrl.upsertBadge,
);

// V2 Job creation (static route before :id)
router.post(
  '/v1/jobs/v2',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(createJobV2Schema),
  ctrl.createJobV2,
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

// ============================================
// V2 Routes
// ============================================

// V2 Status change (with diary entry)
router.post(
  '/v1/jobs/:id/status',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader', 'crew_member'),
  validate(jobParamsSchema, 'params'),
  validate(changeStatusSchema),
  ctrl.changeStatusV2,
);

// Convert assessment to work order
router.post(
  '/v1/jobs/:id/convert-to-wo',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(jobParamsSchema, 'params'),
  ctrl.convertToWorkOrder,
);

// Diary
router.get(
  '/v1/jobs/:id/diary',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader', 'crew_member'),
  validate(jobParamsSchema, 'params'),
  validate(diaryQuerySchema, 'query'),
  ctrl.listDiaryEntries,
);

router.post(
  '/v1/jobs/:id/diary',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader', 'crew_member'),
  validate(jobParamsSchema, 'params'),
  validate(addDiaryNoteSchema),
  ctrl.addDiaryNote,
);

// V2 Photos
router.get(
  '/v1/jobs/:id/photos/v2',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader', 'crew_member'),
  validate(jobParamsSchema, 'params'),
  ctrl.listPhotosV2,
);

router.post(
  '/v1/jobs/:id/photos/v2',
  requireRole('owner', 'div_mgr', 'coordinator', 'crew_leader', 'crew_member'),
  validate(jobParamsSchema, 'params'),
  validate(addPhotoV2Schema),
  ctrl.addPhotoV2,
);

router.patch(
  '/v1/jobs/:id/photos/:photoId',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(photoParamsSchema, 'params'),
  validate(updatePhotoSchema),
  ctrl.updatePhotoV2,
);

router.delete(
  '/v1/jobs/:id/photos/:photoId',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(photoParamsSchema, 'params'),
  ctrl.deletePhotoV2,
);

// Badge assignment (per job)
router.post(
  '/v1/jobs/:id/badges',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(jobParamsSchema, 'params'),
  validate(assignBadgesSchema),
  ctrl.assignBadges,
);

export default router;
