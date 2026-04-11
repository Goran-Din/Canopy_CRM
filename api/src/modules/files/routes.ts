import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  uploadUrlSchema,
  confirmUploadSchema,
  updateFileSchema,
  fileQuerySchema,
  fileIdParamsSchema,
  customerIdParamsSchema,
  createFolderSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// === Folder routes ===

router.get(
  '/v1/customers/:customerId/folders',
  authenticate,
  tenantScope,
  validate(customerIdParamsSchema, 'params'),
  ctrl.listFolders,
);

router.post(
  '/v1/customers/:customerId/folders',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(customerIdParamsSchema, 'params'),
  validate(createFolderSchema),
  ctrl.createFolder,
);

// === File routes (static before :id) ===

router.post(
  '/v1/files/upload-url',
  authenticate,
  tenantScope,
  validate(uploadUrlSchema),
  ctrl.getUploadUrl,
);

router.post(
  '/v1/files/confirm',
  authenticate,
  tenantScope,
  validate(confirmUploadSchema),
  ctrl.confirmUpload,
);

// === Customer file listing ===

router.get(
  '/v1/customers/:customerId/files',
  authenticate,
  tenantScope,
  validate(customerIdParamsSchema, 'params'),
  validate(fileQuerySchema, 'query'),
  ctrl.listFiles,
);

// === Individual file routes ===

router.get(
  '/v1/files/:id',
  authenticate,
  tenantScope,
  validate(fileIdParamsSchema, 'params'),
  ctrl.getFile,
);

router.get(
  '/v1/files/:id/download',
  authenticate,
  tenantScope,
  validate(fileIdParamsSchema, 'params'),
  ctrl.getDownloadUrl,
);

router.patch(
  '/v1/files/:id',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(fileIdParamsSchema, 'params'),
  validate(updateFileSchema),
  ctrl.updateFile,
);

router.delete(
  '/v1/files/:id',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(fileIdParamsSchema, 'params'),
  ctrl.deleteFile,
);

export default router;
