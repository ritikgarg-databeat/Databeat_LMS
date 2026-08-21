import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { loginRateLimiter } from '@/middleware/login-rate-limiter.middleware';

import { AuthController } from './auth.controller';
import { authValidation } from './auth.validation';

// Route definitions for the auth module. Mounted in src/routes/index.ts.
const router = Router();
const controller = new AuthController();

router.post('/login', loginRateLimiter, authValidation.login, controller.login);
router.post('/logout', controller.logout);
router.post('/refresh', controller.refresh);
router.post('/forgot-password', loginRateLimiter, authValidation.forgotPassword, controller.forgotPassword);
router.post('/reset-password', loginRateLimiter, authValidation.resetPassword, controller.resetPassword);

router.post('/change-password', authenticate, authValidation.changePassword, controller.changePassword);
router.get('/me', authenticate, controller.me);
router.post('/validate', authenticate, controller.validate);

export default router;
