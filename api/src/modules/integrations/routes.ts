import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  providerParamsSchema,
  updateConfigSchema,
  connectSchema,
  syncLogQuerySchema,
  entityParamsSchema,
  customerSyncParamsSchema,
  invoiceSyncParamsSchema,
  paymentSyncParamsSchema,
  prospectParamsSchema,
  quoteParamsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// All integration routes require auth + tenant scoping
router.use('/v1/integrations', authenticate, tenantScope);

// ======== Sync Log (before :provider to avoid collision) ========
router.get(
  '/v1/integrations/sync-log',
  requireRole('owner', 'div_mgr'),
  validate(syncLogQuerySchema, 'query'),
  ctrl.getSyncLogs,
);

router.get(
  '/v1/integrations/sync-log/:entityId',
  requireRole('owner', 'div_mgr'),
  validate(entityParamsSchema, 'params'),
  ctrl.getSyncLogsByEntity,
);

// ======== Xero Sync (before :provider to avoid collision) ========
router.post(
  '/v1/integrations/xero/sync-customer/:customerId',
  requireRole('owner', 'coordinator'),
  validate(customerSyncParamsSchema, 'params'),
  ctrl.syncCustomer,
);

router.post(
  '/v1/integrations/xero/sync-invoice/:invoiceId',
  requireRole('owner', 'coordinator'),
  validate(invoiceSyncParamsSchema, 'params'),
  ctrl.syncInvoice,
);

router.post(
  '/v1/integrations/xero/sync-payment/:paymentId',
  requireRole('owner', 'coordinator'),
  validate(paymentSyncParamsSchema, 'params'),
  ctrl.syncPayment,
);

router.post(
  '/v1/integrations/xero/full-sync',
  requireRole('owner'),
  ctrl.fullSync,
);

// ======== Mautic Stubs ========
router.post(
  '/v1/integrations/mautic/push-lead/:prospectId',
  requireRole('owner', 'div_mgr'),
  validate(prospectParamsSchema, 'params'),
  ctrl.stubEndpoint,
);

router.post(
  '/v1/integrations/mautic/pull-leads',
  requireRole('owner', 'div_mgr'),
  ctrl.stubEndpoint,
);

// ======== Google Drive Stubs ========
router.post(
  '/v1/integrations/drive/upload',
  requireRole('owner', 'div_mgr', 'coordinator'),
  ctrl.stubEndpoint,
);

router.get(
  '/v1/integrations/drive/files',
  requireRole('owner', 'div_mgr', 'coordinator'),
  ctrl.stubEndpoint,
);

// ======== Canopy Quotes Stubs ========
router.get(
  '/v1/integrations/quotes',
  requireRole('owner', 'div_mgr'),
  ctrl.stubEndpoint,
);

router.post(
  '/v1/integrations/quotes/:quoteId/convert',
  requireRole('owner', 'div_mgr'),
  validate(quoteParamsSchema, 'params'),
  ctrl.stubEndpoint,
);

// ======== Canopy Ops Stubs ========
router.post(
  '/v1/integrations/ops/context',
  requireRole('owner', 'div_mgr'),
  ctrl.stubEndpoint,
);

router.post(
  '/v1/integrations/ops/job-update',
  requireRole('owner', 'div_mgr'),
  ctrl.stubEndpoint,
);

// ======== NorthChat Stubs ========
router.post(
  '/v1/integrations/northchat/context',
  requireRole('owner', 'div_mgr'),
  ctrl.stubEndpoint,
);

router.post(
  '/v1/integrations/northchat/notify',
  requireRole('owner', 'div_mgr'),
  ctrl.stubEndpoint,
);

// ======== Generic Integration Config (these use :provider param, must be last) ========
router.get(
  '/v1/integrations',
  requireRole('owner'),
  ctrl.listIntegrations,
);

router.get(
  '/v1/integrations/:provider',
  requireRole('owner'),
  validate(providerParamsSchema, 'params'),
  ctrl.getIntegration,
);

router.put(
  '/v1/integrations/:provider',
  requireRole('owner'),
  validate(providerParamsSchema, 'params'),
  validate(updateConfigSchema),
  ctrl.updateConfig,
);

router.post(
  '/v1/integrations/:provider/connect',
  requireRole('owner'),
  validate(providerParamsSchema, 'params'),
  validate(connectSchema),
  ctrl.connect,
);

router.post(
  '/v1/integrations/:provider/disconnect',
  requireRole('owner'),
  validate(providerParamsSchema, 'params'),
  ctrl.disconnect,
);

export default router;
