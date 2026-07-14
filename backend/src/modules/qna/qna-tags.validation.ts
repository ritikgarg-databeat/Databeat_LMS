import { query } from 'express-validator';

// express-validator chains for the qna-tags module's routes, keyed by handler name.
export const qnaTagsValidation = {
  list: [query('search').optional().isString().trim()],
};
