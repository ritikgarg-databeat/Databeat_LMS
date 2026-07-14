import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';

import { DashboardController } from './dashboard.controller';

/**
 * Route definitions for the dashboard module. Mounted at `/dashboard` in src/routes/index.ts
 * (full prefix `/api/v1/dashboard`).
 *
 * Role gating (Prompt 8 § API): `GET /trainee` is a personal view — TRAINEE only, a
 * TRAINER/SUPER_ADMIN calling it gets a 403 (there is no "view as" here, unlike the staff-wide
 * reads elsewhere in this codebase). `GET /trainer` is staff-only (TRAINER + SUPER_ADMIN); the
 * finer "own groups only" trainer scoping lives downstream in analyticsService, which this
 * module's service reuses rather than re-implementing.
 */
const router = Router();
const controller = new DashboardController();

router.use(authenticate);

router.get('/trainee', requireRole(Role.TRAINEE), controller.trainee);
router.get('/trainer', requireRole(Role.TRAINER, Role.SUPER_ADMIN), controller.trainer);

export default router;
