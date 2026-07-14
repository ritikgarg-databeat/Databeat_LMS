import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';
import { idParamValidator } from '@/validators/common.validators';

import { NotificationsController } from './notifications.controller';
import { notificationsValidation } from './notifications.validation';

/**
 * Route definitions for the notifications module. Mounted in src/routes/index.ts at a
 * top-level `/notifications` path. Every route is scoped to the current authenticated user's
 * own notifications (list/unread-count/mark-read/mark-all-read/delete) — the one exception is
 * `POST /announcements` (Prompt 9 § NOTIFICATION SYSTEM), a TRAINER/SUPER_ADMIN-only broadcast
 * surface, gated with `requireRole` exactly like the analytics/assessments modules.
 *
 * `POST /announcements` is registered before any `/:id`-style route, and `DELETE /:id` after
 * it, so Express never parses the literal "announcements" segment as an `:id`.
 */
const router = Router();
const controller = new NotificationsController();

router.use(authenticate);

router.get('/', notificationsValidation.list, controller.list);
router.get('/unread-count', controller.unreadCount);
router.patch('/read-all', controller.markAllRead);
router.post(
  '/announcements',
  requireRole(Role.TRAINER, Role.SUPER_ADMIN),
  notificationsValidation.createAnnouncement,
  controller.createAnnouncement,
);
router.patch('/:id/read', idParamValidator, controller.markRead);
router.delete('/:id', idParamValidator, controller.deleteOne);

export default router;
