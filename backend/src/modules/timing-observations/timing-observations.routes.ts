import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';

import { TimingObservationsController } from './timing-observations.controller';
import { timingObservationsValidation } from './timing-observations.validation';

/**
 * Route definitions for the timing-observations module. Mounted at `/timing-observations` in
 * src/routes/index.ts. TRAINER/SUPER_ADMIN only — trainees have no reason to log or view these.
 */
const router = Router();
const controller = new TimingObservationsController();

router.use(authenticate, requireRole(Role.TRAINER, Role.SUPER_ADMIN));

router.post('/', timingObservationsValidation.create, controller.create);
router.get('/', timingObservationsValidation.list, controller.list);
router.get('/stats', timingObservationsValidation.stats, controller.stats);

export default router;
