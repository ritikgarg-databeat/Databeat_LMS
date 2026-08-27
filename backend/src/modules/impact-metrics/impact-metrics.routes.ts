import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';

import { ImpactMetricsController } from './impact-metrics.controller';
import { impactMetricsValidation } from './impact-metrics.validation';

/**
 * Route definitions for the impact-metrics module. Mounted at `/impact-metrics` in
 * src/routes/index.ts. TRAINER/SUPER_ADMIN only, read-only throughout — every report here
 * derives numbers from data other modules already wrote.
 */
const router = Router();
const controller = new ImpactMetricsController();

router.use(authenticate, requireRole(Role.TRAINER, Role.SUPER_ADMIN));

router.get('/reports/auto-grading-latency', impactMetricsValidation.dateRange, controller.autoGradingLatency);
router.get(
  '/reports/ai-quiz-generation-latency',
  impactMetricsValidation.dateRange,
  controller.aiQuizGenLatency,
);
router.get('/reports/csv-import-speed', impactMetricsValidation.dateRange, controller.csvImportSpeed);
router.get('/pilot-dashboard', impactMetricsValidation.pilotDashboard, controller.pilotDashboard);
router.get('/impact-report', impactMetricsValidation.impactReport, controller.impactReport);

export default router;
