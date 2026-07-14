import type { Request, Response } from 'express';

import { ERROR_CODES, ERROR_MESSAGES } from '@/constants/error-messages';
import { HTTP_STATUS } from '@/constants/http-status';

/** Registered after every route in app.ts — catches requests to unknown endpoints. */
export function notFoundMiddleware(req: Request, res: Response): void {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: `${ERROR_MESSAGES[ERROR_CODES.NOT_FOUND]} (${req.method} ${req.originalUrl})`,
    errors: [],
  });
}
