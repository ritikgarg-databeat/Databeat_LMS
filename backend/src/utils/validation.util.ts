import type { Request } from 'express';
import { validationResult } from 'express-validator';

import { BadRequestError } from '@/utils/app-error';

/**
 * Runs after a route's express-validator chains (see `*.validation.ts` per module) and
 * throws a BadRequestError — caught by error.middleware.ts — if any field failed validation.
 * Call this at the top of every controller method once validation chains exist.
 */
export function assertValidRequest(req: Request): void {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    throw new BadRequestError('Please check the submitted data and try again.', result.array());
  }
}
