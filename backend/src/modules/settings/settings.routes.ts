import { Role } from '@prisma/client';
import { Router } from 'express';
import multer from 'multer';

import { ACCEPTED_AVATAR_MIME_TYPES, MAX_AVATAR_SIZE_BYTES } from '@/constants/settings';
import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';
import { BadRequestError } from '@/utils/app-error';

import { SettingsController } from './settings.controller';
import { settingsValidation } from './settings.validation';

/**
 * Route definitions for the settings module (Prompt 9 § SETTINGS). Mounted at `/settings` in
 * src/routes/index.ts. Every route requires auth; `/platform`'s two routes additionally require
 * SUPER_ADMIN, applied per-route below (mirrors the resources module's `canManage` precedent)
 * rather than on the whole router, since every other route here is reachable by any
 * authenticated user acting on their own settings.
 */
const router = Router();
const controller = new SettingsController();

/**
 * Settings-specific Multer instance — NOT the shared `upload` middleware (memoryStorage but a
 * 200 MB lesson-file cap, wrong for a profile picture) and NOT the qna module's own `qnaUpload`
 * instance (10 MB, a broader document/image MIME allowlist). A profile picture needs its own,
 * much smaller size cap and an image-only MIME allowlist, so this module builds its own
 * dedicated instance — mirrors qna.routes.ts's `qnaUpload` precedent exactly (memoryStorage so
 * the buffer can be handed to `storageProvider.save()`, `fileFilter` rejects unsupported MIME
 * types via a thrown `BadRequestError` surfaced as a 400 by error.middleware.ts).
 */
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    if ((ACCEPTED_AVATAR_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new BadRequestError(`Unsupported file type: ${file.mimetype}.`));
    }
  },
});

router.use(authenticate);

router.get('/', controller.getSummary);
router.patch('/theme', settingsValidation.updateTheme, controller.updateTheme);
router.get('/notification-preferences', controller.getNotificationPreferences);
router.patch(
  '/notification-preferences',
  settingsValidation.updateNotificationPreferences,
  controller.updateNotificationPreferences,
);
router.post('/avatar', avatarUpload.single('file'), controller.uploadAvatar);
router.get('/avatar', controller.downloadAvatar);
router.delete('/avatar', controller.removeAvatar);

router.get('/platform', requireRole(Role.SUPER_ADMIN), controller.getPlatformSettings);
router.patch(
  '/platform',
  requireRole(Role.SUPER_ADMIN),
  settingsValidation.updatePlatformSettings,
  controller.updatePlatformSettings,
);

export default router;
