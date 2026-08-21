import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

import { ERROR_CODES, ERROR_MESSAGES } from '@/constants/error-messages';
import { HTTP_STATUS } from '@/constants/http-status';
import { AppError } from '@/utils/app-error';
import { logger } from '@/utils/logger';

/**
 * Final middleware in the chain (registered last in app.ts). `AppError` instances are
 * operational — their message/status is safe to return as-is. Anything else is an
 * unexpected exception: logged in full, but the client only ever sees a generic message
 * (ARCHITECTURE.md §17 — secure error responses never leak internals).
 */
// `_next` is unused but required — Express only treats a 4-arg middleware as an error handler.
export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, message: err.message, errors: err.details });
    return;
  }

  // Multer raises its own error type for limit violations (e.g. LIMIT_FILE_SIZE when an upload
  // exceeds the route's fileSize cap mid-stream) — a client mistake, not a server fault, so it
  // must not fall through to the generic 500 branch. Message is Multer's own ("File too
  // large"), safe to surface.
  if (err instanceof multer.MulterError) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: err.message, errors: [] });
    return;
  }

  logger.error('Unhandled error', {
    error: err instanceof Error ? err.stack : err,
    path: req.path,
    method: req.method,
    requestId: req.requestId,
    userId: req.user?.id,
  });

  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR],
    errors: [],
  });
}
