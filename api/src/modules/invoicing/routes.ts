import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceStatusSchema,
  invoiceQuerySchema,
  invoiceParamsSchema,
  addLineItemSchema,
  updateLineItemSchema,
  lineItemParamsSchema,
  recordPaymentSchema,
  generateFromContractSchema,
  generateFromJobsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// All invoice routes require auth + tenant scoping
router.use('/v1/invoices', authenticate, tenantScope);

// Static routes before :id to avoid collision
router.get(
  '/v1/invoices/stats',
  requireRole('owner', 'div_mgr'),
  ctrl.getStats,
);

router.get(
  '/v1/invoices/aging-report',
  requireRole('owner', 'div_mgr'),
  ctrl.getAgingReport,
);

router.post(
  '/v1/invoices/generate-from-contract',
  requireRole('owner', 'coordinator'),
  validate(generateFromContractSchema),
  ctrl.generateFromContract,
);

router.post(
  '/v1/invoices/generate-from-jobs',
  requireRole('owner', 'coordinator'),
  validate(generateFromJobsSchema),
  ctrl.generateFromJobs,
);

// Line item routes with lineItemId (before :id to avoid collision)
router.put(
  '/v1/invoices/line-items/:lineItemId',
  requireRole('owner', 'coordinator'),
  validate(lineItemParamsSchema, 'params'),
  validate(updateLineItemSchema),
  ctrl.updateLineItem,
);

router.delete(
  '/v1/invoices/line-items/:lineItemId',
  requireRole('owner', 'coordinator'),
  validate(lineItemParamsSchema, 'params'),
  ctrl.removeLineItem,
);

// Invoice CRUD
router.get(
  '/v1/invoices',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(invoiceQuerySchema, 'query'),
  ctrl.listInvoices,
);

router.get(
  '/v1/invoices/:id',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(invoiceParamsSchema, 'params'),
  ctrl.getInvoice,
);

router.post(
  '/v1/invoices',
  requireRole('owner', 'coordinator'),
  validate(createInvoiceSchema),
  ctrl.createInvoice,
);

router.put(
  '/v1/invoices/:id',
  requireRole('owner', 'coordinator'),
  validate(invoiceParamsSchema, 'params'),
  validate(updateInvoiceSchema),
  ctrl.updateInvoice,
);

router.patch(
  '/v1/invoices/:id/status',
  requireRole('owner', 'coordinator'),
  validate(invoiceParamsSchema, 'params'),
  validate(invoiceStatusSchema),
  ctrl.changeStatus,
);

router.delete(
  '/v1/invoices/:id',
  requireRole('owner'),
  validate(invoiceParamsSchema, 'params'),
  ctrl.deleteInvoice,
);

// Line items for specific invoice
router.post(
  '/v1/invoices/:id/line-items',
  requireRole('owner', 'coordinator'),
  validate(invoiceParamsSchema, 'params'),
  validate(addLineItemSchema),
  ctrl.addLineItem,
);

// Payments
router.post(
  '/v1/invoices/:id/payments',
  requireRole('owner', 'coordinator'),
  validate(invoiceParamsSchema, 'params'),
  validate(recordPaymentSchema),
  ctrl.recordPayment,
);

router.get(
  '/v1/invoices/:id/payments',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(invoiceParamsSchema, 'params'),
  ctrl.getPayments,
);

export default router;
