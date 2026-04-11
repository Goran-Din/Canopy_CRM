import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createQuoteSchema,
  updateQuoteSchema,
  addSectionSchema,
  updateSectionSchema,
  addLineItemSchema,
  updateLineItemSchema,
  generatePdfSchema,
  sendQuoteSchema,
  xeroItemSearchSchema,
  jobIdParamsSchema,
  quoteIdParamsSchema,
  sectionParamsSchema,
  sectionItemParamsSchema,
  lineItemParamsSchema,
  sendQuoteV2Schema,
  resendQuoteSchema,
  convertToInvoiceSchema,
  loadTemplateSchema,
  saveAsTemplateSchema,
  xeroItemsGetSchema,
  declineQuoteSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// === Xero Items (static routes first) ===
router.get(
  '/v1/xero-items',
  authenticate,
  tenantScope,
  validate(xeroItemSearchSchema, 'query'),
  ctrl.searchXeroItems,
);

// === Quotes ===
router.post(
  '/v1/jobs/:jobId/quotes',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(jobIdParamsSchema, 'params'),
  validate(createQuoteSchema),
  ctrl.createQuote,
);

router.get(
  '/v1/jobs/:jobId/quotes',
  authenticate,
  tenantScope,
  validate(jobIdParamsSchema, 'params'),
  ctrl.listQuoteVersions,
);

router.get(
  '/v1/quotes/:id',
  authenticate,
  tenantScope,
  validate(quoteIdParamsSchema, 'params'),
  ctrl.getQuote,
);

router.patch(
  '/v1/quotes/:id',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(quoteIdParamsSchema, 'params'),
  validate(updateQuoteSchema),
  ctrl.updateQuote,
);

// === Sections ===
router.post(
  '/v1/quotes/:id/sections',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(quoteIdParamsSchema, 'params'),
  validate(addSectionSchema),
  ctrl.addSection,
);

router.patch(
  '/v1/quotes/:quoteId/sections/:sectionId',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(sectionParamsSchema, 'params'),
  validate(updateSectionSchema),
  ctrl.updateSection,
);

router.delete(
  '/v1/quotes/:quoteId/sections/:sectionId',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(sectionParamsSchema, 'params'),
  ctrl.deleteSection,
);

// === Line Items ===
router.post(
  '/v1/quotes/:quoteId/sections/:sectionId/items',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(sectionItemParamsSchema, 'params'),
  validate(addLineItemSchema),
  ctrl.addLineItem,
);

router.patch(
  '/v1/quotes/:quoteId/sections/:sectionId/items/:itemId',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(lineItemParamsSchema, 'params'),
  validate(updateLineItemSchema),
  ctrl.updateLineItem,
);

router.delete(
  '/v1/quotes/:quoteId/sections/:sectionId/items/:itemId',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(lineItemParamsSchema, 'params'),
  ctrl.deleteLineItem,
);

// === PDF & Send ===
router.post(
  '/v1/quotes/:id/generate-pdf',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(quoteIdParamsSchema, 'params'),
  validate(generatePdfSchema),
  ctrl.generatePdf,
);

router.post(
  '/v1/quotes/:id/send',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(quoteIdParamsSchema, 'params'),
  validate(sendQuoteV2Schema),
  ctrl.sendQuoteV2,
);

router.post(
  '/v1/quotes/:id/resend',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(quoteIdParamsSchema, 'params'),
  validate(resendQuoteSchema),
  ctrl.resendQuote,
);

// === Signed PDF ===
router.get(
  '/v1/quotes/:id/signed-pdf',
  authenticate,
  tenantScope,
  validate(quoteIdParamsSchema, 'params'),
  ctrl.getSignedPdf,
);

// === Convert to Invoice ===
router.post(
  '/v1/quotes/:id/convert-to-invoice',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr'),
  validate(quoteIdParamsSchema, 'params'),
  validate(convertToInvoiceSchema),
  ctrl.convertToInvoice,
);

// === Template Integration ===
router.post(
  '/v1/quotes/:id/load-template',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(quoteIdParamsSchema, 'params'),
  validate(loadTemplateSchema),
  ctrl.loadTemplate,
);

router.post(
  '/v1/quotes/:id/save-as-template',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(quoteIdParamsSchema, 'params'),
  validate(saveAsTemplateSchema),
  ctrl.saveAsTemplate,
);

// === Decline Quote ===
router.patch(
  '/v1/quotes/:id/decline',
  authenticate,
  tenantScope,
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(quoteIdParamsSchema, 'params'),
  validate(declineQuoteSchema),
  ctrl.declineQuote,
);

// === Xero Items GET ===
router.get(
  '/v1/xero-items',
  authenticate,
  tenantScope,
  validate(xeroItemsGetSchema, 'query'),
  ctrl.searchXeroItemsGet,
);

export default router;
