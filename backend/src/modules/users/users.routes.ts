import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';
import { idParamValidator } from '@/validators/common.validators';

import { UsersController } from './users.controller';
import { usersValidation } from './users.validation';

// Route definitions for the users module. Mounted in src/routes/index.ts.
const router = Router();
const controller = new UsersController();

const canManageUsers = requireRole(Role.TRAINER, Role.SUPER_ADMIN);

router.use(authenticate);

// Self-service — must be registered before "/:id" so "me" isn't parsed as an id param.
router.patch('/me', usersValidation.updateOwnProfile, controller.updateOwnProfile);

router.get('/', canManageUsers, usersValidation.list, controller.list);
router.post('/', canManageUsers, usersValidation.create, controller.create);
router.get('/:id', canManageUsers, idParamValidator, controller.getById);
router.patch('/:id', canManageUsers, idParamValidator, usersValidation.update, controller.update);
router.patch('/:id/deactivate', canManageUsers, idParamValidator, controller.deactivate);
router.patch('/:id/reactivate', canManageUsers, idParamValidator, controller.reactivate);
router.post(
  '/:id/reset-password',
  canManageUsers,
  idParamValidator,
  usersValidation.resetPassword,
  controller.resetPassword,
);
router.patch(
  '/:id/role',
  requireRole(Role.SUPER_ADMIN),
  idParamValidator,
  usersValidation.changeRole,
  controller.changeRole,
);

export default router;
