import { param, query } from 'express-validator';

import { APP_CONFIG } from '@/config/app.config';
import { VALIDATION_MESSAGES } from '@/constants/validation-messages';

/**
 * Cross-module express-validator chains. Module-specific chains live in each module's
 * own `*.validation.ts` — put a rule here only when more than one module needs it verbatim.
 */
export const idParamValidator = param('id').isUUID().withMessage(VALIDATION_MESSAGES.INVALID_ID('id'));

export const paginationQueryValidators = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: APP_CONFIG.MAX_PAGE_SIZE }).toInt(),
];
