import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';

import { ReportsController } from './reports.controller';
import { reportsValidation } from './reports.validation';

/**
 * Route definitions for the reports module (Prompt 8 — CSV report exports). Mounted at
 * `/reports` in src/routes/index.ts, giving full paths like `/api/v1/reports/progress/export`.
 *
 * Every route is TRAINER/SUPER_ADMIN-only (Prompt 8 § SECURITY). Data-level scoping — a
 * trainer only ever exports data for groups where `Group.trainerId` is theirs — is enforced in
 * reports.service.ts (`resolveScopedGroupIds`), since it depends on data, not just role.
 */
const router = Router();
const controller = new ReportsController();

router.use(authenticate, requireRole(Role.TRAINER, Role.SUPER_ADMIN));

router.get('/progress/export', reportsValidation.exportProgress, controller.exportProgress);
router.get('/results/export', reportsValidation.exportResults, controller.exportResults);
router.get('/groups/export', controller.exportGroups);
router.get('/courses/export', controller.exportCourses);
router.get('/mandatory/export', controller.exportMandatory);

export default router;
