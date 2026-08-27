import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';
import { groupMembersRoutes } from '@/modules/group-members';
import { idParamValidator } from '@/validators/common.validators';

import { GroupsController } from './groups.controller';
import { groupsValidation } from './groups.validation';

/**
 * Route definitions for the groups module. Mounted in src/routes/index.ts.
 * "Only Trainers and Super Admins manage organization data; Trainees get read-only access
 * where appropriate" (Prompt 4 § SECURITY) — a Trainee may GET their own group's detail
 * (and roster, see group-members.routes.ts), enforced inside the controller/service since
 * it depends on membership, not just role. Every other route stays Trainer/Super-Admin only.
 */
const router = Router();
const controller = new GroupsController();
const canManage = requireRole(Role.TRAINER, Role.SUPER_ADMIN);

router.use(authenticate);

router.get('/', canManage, groupsValidation.list, controller.list);
router.post('/', canManage, groupsValidation.create, controller.create);
router.get('/stats', canManage, controller.stats);
// Registered before `/:id` so Express doesn't parse "mine" as the `:id` param (same precedent
// as `GET /courses/mine` — see courses.routes.ts). Any authenticated role may call this — a
// Trainee has no other way to discover which groups they belong to, since `GET /` itself is
// Trainer/Super-Admin-only (Prompt 7 § GROUP VISIBILITY needs this for the Q&A "Ask Question"
// form's group picker).
router.get('/mine', controller.mine);
router.get('/:id', idParamValidator, controller.getById);
router.patch('/:id', canManage, idParamValidator, groupsValidation.update, controller.update);
router.patch(
  '/:id/status',
  canManage,
  idParamValidator,
  groupsValidation.updateStatus,
  controller.updateStatus,
);
router.patch(
  '/:id/trainer',
  canManage,
  idParamValidator,
  groupsValidation.assignTrainer,
  controller.assignTrainer,
);
router.post('/:id/duplicate', canManage, idParamValidator, groupsValidation.duplicate, controller.duplicate);
router.delete('/:id', canManage, idParamValidator, controller.remove);

router.use('/:groupId/members', groupMembersRoutes);

export default router;
