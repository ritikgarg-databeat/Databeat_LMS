import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';
import { idParamValidator } from '@/validators/common.validators';

import { DepartmentsController } from './departments.controller';
import { departmentsValidation } from './departments.validation';

/**
 * Route definitions for the departments module. Mounted in src/routes/index.ts.
 * "Only Trainers and Super Admins manage organization data" (Prompt 4 § SECURITY) —
 * applies to reads too, since a department directory isn't meaningful to a Trainee.
 */
const router = Router();
const controller = new DepartmentsController();
const canRead = requireRole(Role.TRAINER, Role.SUPER_ADMIN);
const adminOnly = requireRole(Role.SUPER_ADMIN);

router.use(authenticate, canRead);

router.get('/', departmentsValidation.list, controller.list);
router.post('/', adminOnly, departmentsValidation.create, controller.create);
router.get('/:id', idParamValidator, controller.getById);
router.patch('/:id', adminOnly, idParamValidator, departmentsValidation.update, controller.update);
router.patch('/:id/status', adminOnly, idParamValidator, departmentsValidation.updateStatus, controller.updateStatus);

export default router;
