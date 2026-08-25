import { Role } from '@prisma/client';
import { Router } from 'express';

import { aiRateLimiter } from '@/middleware/ai-rate-limiter.middleware';
import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';
import { idParamValidator } from '@/validators/common.validators';

import { AiController } from './ai.controller';
import { aiValidation } from './ai.validation';

// Route definitions for the ai module. Mounted at /ai in src/routes/index.ts.
// Every route requires auth (Prompt 7 § AI SECURITY) — open to all three roles, since the AI
// Learning Assistant isn't trainee-exclusive at the API level (the UI surfaces it primarily on
// the trainee experience, but a trainer/admin asking it a question is not a security concern).
const router = Router();
const controller = new AiController();

router.use(authenticate);

router.post('/chat', aiRateLimiter, aiValidation.chat, controller.chat);
router.post(
  '/video-generations',
  requireRole(Role.TRAINEE),
  aiRateLimiter,
  aiValidation.createVideo,
  controller.createVideo,
);
router.get(
  '/video-generations/:jobId',
  requireRole(Role.TRAINEE),
  aiValidation.videoJob,
  controller.getVideo,
);
router.get(
  '/video-generations/:jobId/preview',
  requireRole(Role.TRAINEE),
  aiValidation.videoJob,
  controller.previewVideo,
);
router.post(
  '/video-generations/:jobId/retry',
  requireRole(Role.TRAINEE),
  aiValidation.videoJob,
  controller.retryVideo,
);
router.get('/history', aiValidation.listHistory, controller.listHistory);
// Staff-only org-wide aggregates for the trainer dashboard's "AI usage overview" widget.
router.get('/usage', requireRole(Role.TRAINER, Role.SUPER_ADMIN), controller.getUsage);
router.delete('/history', controller.deleteHistory);
router.get('/conversations/:id', idParamValidator, controller.getConversation);
router.delete('/conversations/:id', idParamValidator, controller.deleteConversation);

export default router;
