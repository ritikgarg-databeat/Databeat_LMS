import { Role } from '@prisma/client';
import { Router } from 'express';
import multer from 'multer';

import { ACCEPTED_MEMBER_IMPORT_MIME_TYPES, MAX_MEMBER_IMPORT_FILE_SIZE_BYTES } from '@/constants/groups';
import { requireRole } from '@/middleware/rbac.middleware';

import { GroupMembersController } from './group-members.controller';
import { groupMembersValidation } from './group-members.validation';

/**
 * Route definitions for the group-members module. Mounted *inside* groups.routes.ts at
 * `/:groupId/members` with `mergeParams: true` so `req.params.groupId` resolves from the
 * parent router — kept as its own module folder per the layered architecture (routes/
 * controller/service/repository), just nested in the URL rather than at a top-level path.
 *
 * `GET /` (roster) allows a Trainee to view their own group's members (Prompt 4 § SECURITY
 * "read-only where appropriate"), enforced in the service since it depends on membership,
 * not just role. Every other route stays Trainer/Super-Admin only.
 */
const router = Router({ mergeParams: true });
const controller = new GroupMembersController();
const canManage = requireRole(Role.TRAINER, Role.SUPER_ADMIN);

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MEMBER_IMPORT_FILE_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (
      !ACCEPTED_MEMBER_IMPORT_MIME_TYPES.includes(
        file.mimetype as (typeof ACCEPTED_MEMBER_IMPORT_MIME_TYPES)[number],
      )
    ) {
      callback(new Error('Only CSV files are accepted.'));
      return;
    }
    callback(null, true);
  },
});

router.get('/', groupMembersValidation.list, controller.list);
router.post('/', canManage, groupMembersValidation.add, controller.add);
router.post('/bulk', canManage, groupMembersValidation.addMany, controller.addMany);
router.post('/bulk-import', canManage, csvUpload.single('file'), controller.bulkImport);
router.delete('/:userId', canManage, groupMembersValidation.remove, controller.remove);
router.post('/:userId/transfer', canManage, groupMembersValidation.transfer, controller.transfer);

export default router;
