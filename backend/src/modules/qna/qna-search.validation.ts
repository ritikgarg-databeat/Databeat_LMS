import { query } from 'express-validator';

import { MAX_SEARCH_LIMIT_PER_CATEGORY } from './qna-search.types';

// express-validator chains for the qna-search module's routes, keyed by handler name.
export const qnaSearchValidation = {
  search: [
    query('q').trim().notEmpty().withMessage('q is required.'),
    query('limit').optional().isInt({ min: 1, max: MAX_SEARCH_LIMIT_PER_CATEGORY }).toInt(),
  ],
};
