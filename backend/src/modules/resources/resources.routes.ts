import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';
import { upload } from '@/middleware/upload.middleware';

import { ResourcesController } from './resources.controller';
import { resourcesValidation } from './resources.validation';

/**
 * Route definitions for the resources module. Meant to be mounted *inside* lessons.routes.ts at
 * `/:id/resources` with `mergeParams: true` — mirrors exactly how group-members.routes.ts is
 * mounted inside groups.routes.ts. lessons.routes.ts uses `:id` (not `:lessonId`) as its own id
 * param throughout, so this router (and resources.controller.ts) reads the lesson id off
 * `req.params.id` too — see README.md for the exact mount call.
 *
 * `GET /` (list) and `GET /:resourceId/download` are reachable by any authenticated role — RBAC
 * is enforced inside the service via the self-contained lesson-accessibility check (Prompt 5 §
 * SECURITY), since it depends on course/group assignment, not just role. Every other route
 * (upload/create/delete) stays Trainer/Super-Admin only.
 */
const router = Router({ mergeParams: true });
const controller = new ResourcesController();
const canManage = requireRole(Role.TRAINER, Role.SUPER_ADMIN);

router.use(authenticate);

router.get('/', controller.list);
router.post('/upload', canManage, upload.single('file'), resourcesValidation.upload, controller.uploadResource);
router.post('/text', canManage, resourcesValidation.createText, controller.createTextResource);
router.delete('/:resourceId', canManage, resourcesValidation.remove, controller.remove);
router.get('/:resourceId/download', resourcesValidation.download, controller.download);

export default router;
