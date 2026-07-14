import type { Response } from 'express';

import { HTTP_STATUS } from '@/constants/http-status';

/** The exact response envelope every endpoint must use (ARCHITECTURE.md / project foundation spec). */
export interface ApiSuccessBody<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  errors: unknown[];
}

/**
 * Sends the standard success envelope. Controllers should call this instead of `res.json()`
 * directly, so every endpoint's response shape stays identical without each one re-typing it.
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode: number = HTTP_STATUS.OK,
): Response<ApiSuccessBody<T>> {
  return res.status(statusCode).json({ success: true, message, data });
}

/** Sends the standard error envelope. Prefer throwing an AppError and letting error.middleware.ts call this. */
export function sendError(
  res: Response,
  message: string,
  errors: unknown[] = [],
  statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
): Response<ApiErrorBody> {
  return res.status(statusCode).json({ success: false, message, errors });
}
