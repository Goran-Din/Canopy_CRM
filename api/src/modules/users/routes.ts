import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenant.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  userQuerySchema,
  userParamsSchema,
  createUserSchema,
  updateUserSchema,
  changePasswordSchema,
  assignRoleSchema,
  assignDivisionSchema,
  roleParamsSchema,
  divisionParamsSchema,
} from './schema.js';
import * as ctrl from './controller.js';

const router = Router();

router.use('/v1/users', authenticate, tenantScope);

// Stats (before :id to avoid conflict)
router.get('/v1/users/stats', requireRole('owner'), ctrl.getStats);

// List & CRUD
router.get('/v1/users', requireRole('owner'), validate(userQuerySchema, 'query'), ctrl.listUsers);
router.get('/v1/users/:id', requireRole('owner'), validate(userParamsSchema, 'params'), ctrl.getUser);
router.post('/v1/users', requireRole('owner'), validate(createUserSchema), ctrl.createUser);
router.put('/v1/users/:id', requireRole('owner'), validate(userParamsSchema, 'params'), validate(updateUserSchema), ctrl.updateUser);

// Password
router.put('/v1/users/:id/password', validate(userParamsSchema, 'params'), validate(changePasswordSchema), ctrl.changePassword);

// Activate / Deactivate
router.post('/v1/users/:id/deactivate', requireRole('owner'), validate(userParamsSchema, 'params'), ctrl.deactivateUser);
router.post('/v1/users/:id/activate', requireRole('owner'), validate(userParamsSchema, 'params'), ctrl.activateUser);

// Roles
router.post('/v1/users/:id/roles', requireRole('owner'), validate(userParamsSchema, 'params'), validate(assignRoleSchema), ctrl.assignRole);
router.delete('/v1/users/:id/roles/:role', requireRole('owner'), validate(roleParamsSchema, 'params'), ctrl.removeRole);

// Divisions
router.post('/v1/users/:id/divisions', requireRole('owner'), validate(userParamsSchema, 'params'), validate(assignDivisionSchema), ctrl.assignDivision);
router.delete('/v1/users/:id/divisions/:division', requireRole('owner'), validate(divisionParamsSchema, 'params'), ctrl.removeDivision);

export default router;
