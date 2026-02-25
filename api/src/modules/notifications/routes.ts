import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  notificationQuerySchema,
  notificationParamsSchema,
  updatePreferencesSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// All notification routes require auth + tenant — no role restriction (all authenticated users)
router.use('/v1/notifications', authenticate, tenantScope);

router.get(
  '/v1/notifications',
  validate(notificationQuerySchema, 'query'),
  ctrl.listNotifications,
);

router.get(
  '/v1/notifications/unread-count',
  ctrl.getUnreadCount,
);

router.patch(
  '/v1/notifications/:id/read',
  validate(notificationParamsSchema, 'params'),
  ctrl.markAsRead,
);

router.post(
  '/v1/notifications/mark-all-read',
  ctrl.markAllAsRead,
);

router.get(
  '/v1/notifications/preferences',
  ctrl.getPreferences,
);

router.put(
  '/v1/notifications/preferences',
  validate(updatePreferencesSchema),
  ctrl.updatePreferences,
);

export default router;
