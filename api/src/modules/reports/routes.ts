import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  reportQuerySchema,
  revenueByCustomerQuerySchema,
  contractRenewalQuerySchema,
  snowProfitQuerySchema,
  materialUsageQuerySchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

router.use('/v1/reports', authenticate, tenantScope, requireRole('owner', 'div_mgr'));

router.get('/v1/reports/revenue-summary', validate(reportQuerySchema, 'query'), ctrl.revenueSummary);
router.get('/v1/reports/revenue-by-division', validate(reportQuerySchema, 'query'), ctrl.revenueByDivision);
router.get('/v1/reports/revenue-by-customer', validate(revenueByCustomerQuerySchema, 'query'), ctrl.revenueByCustomer);
router.get('/v1/reports/invoice-aging', validate(reportQuerySchema, 'query'), ctrl.invoiceAging);
router.get('/v1/reports/contract-renewals', validate(contractRenewalQuerySchema, 'query'), ctrl.contractRenewals);
router.get('/v1/reports/crew-productivity', validate(reportQuerySchema, 'query'), ctrl.crewProductivity);
router.get('/v1/reports/time-tracking-summary', validate(reportQuerySchema, 'query'), ctrl.timeTrackingSummary);
router.get('/v1/reports/snow-profitability', validate(snowProfitQuerySchema, 'query'), ctrl.snowProfitability);
router.get('/v1/reports/hardscape-pipeline', ctrl.hardscapePipeline);
router.get('/v1/reports/prospect-conversion', ctrl.prospectConversion);
router.get('/v1/reports/equipment-summary', ctrl.equipmentSummary);
router.get('/v1/reports/material-usage', validate(materialUsageQuerySchema, 'query'), ctrl.materialUsage);

export default router;
