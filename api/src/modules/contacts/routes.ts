import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenantScope } from '../../middleware/tenant.js';
import { validate } from '../../middleware/validate.js';
import {
  createContactSchema,
  updateContactSchema,
  contactQuerySchema,
  contactParamsSchema,
  customerParamsSchema,
  propertyParamsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

// All contact routes require auth + tenant scoping
router.use('/v1/contacts', authenticate, tenantScope);

// Static routes before :id to avoid collision
router.get(
  '/v1/contacts/by-customer/:customerId',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(customerParamsSchema, 'params'),
  ctrl.getContactsByCustomer,
);

router.get(
  '/v1/contacts/by-property/:propertyId',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(propertyParamsSchema, 'params'),
  ctrl.getContactsByProperty,
);

router.get(
  '/v1/contacts',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(contactQuerySchema, 'query'),
  ctrl.listContacts,
);

router.get(
  '/v1/contacts/:id',
  requireRole('owner', 'div_mgr', 'coordinator'),
  validate(contactParamsSchema, 'params'),
  ctrl.getContact,
);

router.post(
  '/v1/contacts',
  requireRole('owner', 'coordinator'),
  validate(createContactSchema),
  ctrl.createContact,
);

router.put(
  '/v1/contacts/:id/set-primary',
  requireRole('owner', 'coordinator'),
  validate(contactParamsSchema, 'params'),
  ctrl.setPrimary,
);

router.put(
  '/v1/contacts/:id',
  requireRole('owner', 'coordinator'),
  validate(contactParamsSchema, 'params'),
  validate(updateContactSchema),
  ctrl.updateContact,
);

router.delete(
  '/v1/contacts/:id',
  requireRole('owner'),
  validate(contactParamsSchema, 'params'),
  ctrl.deleteContact,
);

export default router;
