import { body, param } from 'express-validator';

import { env } from '@/config/env';

import { VIDEO_SCENE_TYPES, VIDEO_VOICES } from './video-generation.types';

const jobId = param('jobId').isUUID().withMessage('jobId must be a valid UUID.');
const styles = ['CLEAN_CORPORATE', 'VISUAL_EXPLAINER', 'CODE_WALKTHROUGH'];

export const videoGenerationValidation = {
  job: [jobId],
  create: [
    body('selectedResourceIds').optional().isArray({ max: 50 }),
    body('selectedResourceIds.*').isUUID(),
    body('creativeInstructions').optional().trim().isLength({ max: 2000 }),
    body('targetDurationSeconds')
      .optional()
      .isInt({ min: 60, max: Math.max(60, env.VIDEO_MAX_DURATION_SECONDS) }),
    body('language').optional().trim().isLength({ min: 2, max: 50 }),
    body('voice').optional().isIn(VIDEO_VOICES),
    body('style').optional().isIn(styles),
  ],
  storyboard: [
    jobId,
    body('storyboard').isObject(),
    body('storyboard.version').equals('1'),
    body('storyboard.title').trim().isLength({ min: 1, max: 180 }),
    body('storyboard.language').trim().isLength({ min: 2, max: 50 }),
    body('storyboard.scenes').isArray({ min: 2, max: 40 }),
    body('storyboard.scenes.*.type').isIn(VIDEO_SCENE_TYPES),
  ],
  regenerate: [
    jobId,
    body('sceneIds').optional().isArray({ min: 1, max: 20 }),
    body('sceneIds.*').isString(),
  ],
};
