import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  signingTokenParamSchema,
  submitSignatureSchema,
  quoteIdParamsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

const isTest = process.env.NODE_ENV === 'test';

// Rate limiters for public signing endpoints (disabled in test)
const rateLimitSigningGet = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 1000 : 10,
  keyGenerator: (req) => req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
});

const rateLimitSigningPost = rateLimit({
  windowMs: 60 * 1000,
  max: isTest ? 1000 : 5,
  keyGenerator: (req) => req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
});

// === PUBLIC endpoints (no authentication) ===
router.get(
  '/v1/quotes/sign/:token',
  rateLimitSigningGet,
  validate(signingTokenParamSchema, 'params'),
  ctrl.getSigningPage,
);

router.post(
  '/v1/quotes/sign',
  rateLimitSigningPost,
  validate(submitSignatureSchema),
  ctrl.submitSignature,
);

// === STAFF endpoints (authenticated) ===
router.get(
  '/v1/quotes/:id/signature',
  authenticate,
  tenantScope,
  validate(quoteIdParamsSchema, 'params'),
  ctrl.getSignatureDetails,
);

export default router;
