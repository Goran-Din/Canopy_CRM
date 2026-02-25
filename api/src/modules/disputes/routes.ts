import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createDisputeSchema,
  updateDisputeSchema,
  resolveDisputeSchema,
  disputeQuerySchema,
  disputeParamsSchema,
  createCreditNoteSchema,
  creditNoteQuerySchema,
  creditNoteParamsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// All dispute routes require auth + tenant scoping
router.use('/v1/disputes', authenticate, tenantScope);
router.use('/v1/credit-notes', authenticate, tenantScope);

// --- Disputes: static routes before :id ---
router.get(
  '/v1/disputes/stats',
  requireRole('owner', 'div_mgr'),
  ctrl.getStats,
);

// --- Disputes: CRUD ---
router.get(
  '/v1/disputes',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(disputeQuerySchema, 'query'),
  ctrl.listDisputes,
);

router.get(
  '/v1/disputes/:id',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(disputeParamsSchema, 'params'),
  ctrl.getDispute,
);

router.post(
  '/v1/disputes',
  requireRole('owner', 'coordinator'),
  validate(createDisputeSchema),
  ctrl.createDispute,
);

router.put(
  '/v1/disputes/:id',
  requireRole('owner', 'coordinator'),
  validate(disputeParamsSchema, 'params'),
  validate(updateDisputeSchema),
  ctrl.updateDispute,
);

router.post(
  '/v1/disputes/:id/resolve',
  requireRole('owner', 'div_mgr'),
  validate(disputeParamsSchema, 'params'),
  validate(resolveDisputeSchema),
  ctrl.resolveDispute,
);

// --- Credit Notes: CRUD ---
router.get(
  '/v1/credit-notes',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(creditNoteQuerySchema, 'query'),
  ctrl.listCreditNotes,
);

router.get(
  '/v1/credit-notes/:id',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(creditNoteParamsSchema, 'params'),
  ctrl.getCreditNote,
);

router.post(
  '/v1/credit-notes',
  requireRole('owner'),
  validate(createCreditNoteSchema),
  ctrl.createCreditNote,
);

router.post(
  '/v1/credit-notes/:id/approve',
  requireRole('owner', 'div_mgr'),
  validate(creditNoteParamsSchema, 'params'),
  ctrl.approveCreditNote,
);

router.post(
  '/v1/credit-notes/:id/apply',
  requireRole('owner'),
  validate(creditNoteParamsSchema, 'params'),
  ctrl.applyCreditNote,
);

router.post(
  '/v1/credit-notes/:id/void',
  requireRole('owner'),
  validate(creditNoteParamsSchema, 'params'),
  ctrl.voidCreditNote,
);

export default router;
