import { body, param, query } from 'express-validator';

import { MAX_AI_MESSAGE_LENGTH } from '@/constants/ai';
import { paginationQueryValidators } from '@/validators/common.validators';

const AI_FEATURES = [
  'CHAT',
  'EXPLAIN_TOPIC',
  'SUMMARIZE_LESSON',
  'GENERATE_EXAMPLES',
  'GENERATE_PRACTICE_QUESTIONS',
];
const AI_EXPLANATION_LEVELS = ['BEGINNER', 'DETAILED', 'INTERVIEW'];

// express-validator chains for the ai module's routes, keyed by handler name.
export const aiValidation = {
  chat: [
    body('conversationId').optional().isUUID().withMessage('conversationId must be a valid UUID.'),
    body('lessonId').optional().isUUID().withMessage('lessonId must be a valid UUID.'),
    body('message')
      .trim()
      .notEmpty()
      .withMessage('Message is required.')
      .isLength({ max: MAX_AI_MESSAGE_LENGTH })
      .withMessage(`Message must be ${MAX_AI_MESSAGE_LENGTH} characters or fewer.`),
    body('feature').optional().isIn(AI_FEATURES).withMessage('Invalid feature.'),
    body('explanationLevel').optional().isIn(AI_EXPLANATION_LEVELS).withMessage('Invalid explanationLevel.'),
  ],
  listHistory: [...paginationQueryValidators, query('lessonId').optional().isUUID()],
  createVideo: [
    body('conversationId').optional().isUUID().withMessage('conversationId must be a valid UUID.'),
    body('lessonId').optional().isUUID().withMessage('lessonId must be a valid UUID.'),
    body('message')
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage('Video instructions must be 2,000 characters or fewer.'),
  ],
  videoJob: [param('jobId').isUUID().withMessage('jobId must be a valid UUID.')],
};
