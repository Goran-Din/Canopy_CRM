import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { loginSchema } from './schema.js';
import { loginHandler, refreshHandler, logoutHandler } from './controller.js';

const router = Router();

router.post('/auth/login', validate(loginSchema), loginHandler);
router.post('/auth/refresh', refreshHandler);
router.post('/auth/logout', logoutHandler);

export default router;
