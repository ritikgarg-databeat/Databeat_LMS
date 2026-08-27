import { ResourceType } from '@prisma/client';
import { body, param } from 'express-validator';

import {
  MAX_CODE_SNIPPET_LENGTH,
  MAX_MARKDOWN_CONTENT_LENGTH,
  MAX_RESOURCE_TITLE_LENGTH,
} from '@/constants/classroom';
import { VALIDATION_MESSAGES } from '@/constants/validation-messages';

import { TEXT_BACKED_RESOURCE_TYPES } from './resources.types';

const resourceIdParamValidator = param('resourceId')
  .isUUID()
  .withMessage(VALIDATION_MESSAGES.INVALID_ID('resourceId'));

const titleChain = body('title')
  .trim()
  .isLength({ min: 1, max: MAX_RESOURCE_TITLE_LENGTH })
  .withMessage(VALIDATION_MESSAGES.MIN_LENGTH('title', 1));

export const resourcesValidation = {
  // `type` here is only checked against the full ResourceType enum — resources.service.ts is
  // what enforces "must be file-backed" and points the caller at `/resources/text` otherwise,
  // so that guidance survives as a clear top-level error message instead of being buried in
  // express-validator's `details` array.
  upload: [
    titleChain,
    body('type').isIn(Object.values(ResourceType)).withMessage('type must be a valid resource type.'),
  ],

  createText: [
    body('type')
      .isIn(TEXT_BACKED_RESOURCE_TYPES)
      .withMessage(`type must be one of: ${TEXT_BACKED_RESOURCE_TYPES.join(', ')}.`),
    titleChain,
    body('content')
      .exists({ values: 'falsy' })
      .withMessage(VALIDATION_MESSAGES.REQUIRED('content'))
      .bail()
      .isString()
      .withMessage('content must be a string.')
      .bail()
      .custom((value: string, { req }) => {
        if (req.body?.type === ResourceType.MARKDOWN && value.length > MAX_MARKDOWN_CONTENT_LENGTH) {
          throw new Error(
            `content must be at most ${MAX_MARKDOWN_CONTENT_LENGTH} characters for MARKDOWN resources.`,
          );
        }
        if (req.body?.type === ResourceType.CODE_SNIPPET && value.length > MAX_CODE_SNIPPET_LENGTH) {
          throw new Error(
            `content must be at most ${MAX_CODE_SNIPPET_LENGTH} characters for CODE_SNIPPET resources.`,
          );
        }
        return true;
      }),
    body('content')
      .if(body('type').equals(ResourceType.EXTERNAL_LINK))
      .isURL({ require_protocol: true })
      .withMessage('content must be a well-formed absolute URL.'),
  ],

  remove: [resourceIdParamValidator],

  download: [resourceIdParamValidator],

  progress: [
    resourceIdParamValidator,
    body('event').isIn(['OPEN', 'VIEW', 'VIDEO_HEARTBEAT', 'ACKNOWLEDGE']).withMessage('event is invalid.'),
    body('activeSecondsDelta').optional().isInt({ min: 0, max: 60 }).toInt(),
    body('scrollPercentage').optional().isInt({ min: 0, max: 100 }).toInt(),
    body('positionSeconds').optional().isFloat({ min: 0 }).toFloat(),
    body('durationSeconds').optional().isFloat({ min: 0.1, max: 86400 }).toFloat(),
    body('watchedFromSeconds').optional().isFloat({ min: 0 }).toFloat(),
    body('watchedToSeconds').optional().isFloat({ min: 0 }).toFloat(),
  ],
};
