import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';
import { idParamValidator } from '@/validators/common.validators';

import { ExperienceLevelsController } from './experience-levels.controller';
import { experienceLevelsValidation } from './experience-levels.validation';

// Route definitions for the experience-levels module. Mounted in src/routes/index.ts.
const router = Router();
const controller = new ExperienceLevelsController();
const canManage = requireRole(Role.TRAINER, Role.SUPER_ADMIN);
const adminOnly = requireRole(Role.SUPER_ADMIN);

router.use(authenticate);

// Active-only list — used to populate dropdowns everywhere (any authenticated role).
router.get('/', controller.list);
router.get('/all', canManage, controller.listAll);
router.post('/', adminOnly, experienceLevelsValidation.create, controller.create);
router.patch('/:id', adminOnly, idParamValidator, experienceLevelsValidation.update, controller.update);

export default router;
