import { Role } from '@prisma/client';
import { Router } from 'express';

import { aiRateLimiter } from '@/middleware/ai-rate-limiter.middleware';
import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';

import { VideoGenerationController } from './video-generation.controller';
import { videoGenerationValidation } from './video-generation.validation';

const router = Router({ mergeParams: true });
const controller = new VideoGenerationController();

router.use(authenticate, requireRole(Role.TRAINER, Role.SUPER_ADMIN));
router.get('/sources', controller.sources);
router.get('/', controller.list);
router.post('/', aiRateLimiter, videoGenerationValidation.create, controller.create);
router.get('/:jobId', videoGenerationValidation.job, controller.get);
router.patch('/:jobId/storyboard', videoGenerationValidation.storyboard, controller.updateStoryboard);
router.post('/:jobId/regenerate', aiRateLimiter, videoGenerationValidation.regenerate, controller.regenerate);
router.post('/:jobId/render', videoGenerationValidation.job, controller.render);
router.get('/:jobId/preview', videoGenerationValidation.job, controller.preview);
router.post('/:jobId/publish', videoGenerationValidation.job, controller.publish);
router.post('/:jobId/cancel', videoGenerationValidation.job, controller.cancel);

export default router;
