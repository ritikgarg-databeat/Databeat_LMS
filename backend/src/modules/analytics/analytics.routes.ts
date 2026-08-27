import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';
import { idParamValidator } from '@/validators/common.validators';

import { AnalyticsController } from './analytics.controller';
import { analyticsValidation } from './analytics.validation';

/**
 * Route definitions for the analytics module. Mounted at `/analytics` in src/routes/index.ts
 * (full prefix `/api/v1/analytics`).
 *
 * Role gating (Prompt 8 § SECURITY): group/leaderboard/course/assessment analytics are staff
 * routes (TRAINER + SUPER_ADMIN — the finer "own groups/trainees only" trainer scoping lives in
 * analytics.service.ts since it depends on data, not just role). `GET /users/:id` deliberately
 * has NO requireRole: the service enforces self-or-visible, which lets a Trainee fetch their
 * own analytics by id. `POST /refresh` is SUPER_ADMIN only.
 */
const router = Router();
const controller = new AnalyticsController();
const staffOnly = requireRole(Role.TRAINER, Role.SUPER_ADMIN);

router.use(authenticate);

// Static `/me` is registered before any `/:id`-style sibling (same precedent as
// `GET /groups/mine` — see groups.routes.ts); the remaining routes are distinct prefixes.
router.get('/me', controller.me);
router.get('/overview', staffOnly, analyticsValidation.overview, controller.overview);
router.get('/groups', staffOnly, analyticsValidation.groups, controller.groups);
router.get('/groups/:id', staffOnly, idParamValidator, controller.groupById);
router.get('/leaderboard', staffOnly, analyticsValidation.leaderboard, controller.leaderboard);
router.get('/courses/:id', staffOnly, idParamValidator, controller.courseById);
router.get('/assessments/:id', staffOnly, idParamValidator, controller.assessmentById);
router.get('/users/:id', idParamValidator, controller.userById);
router.post('/refresh', requireRole(Role.SUPER_ADMIN), controller.refresh);

export default router;
