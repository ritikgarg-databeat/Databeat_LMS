import { ERROR_CODES, ERROR_MESSAGES, type ErrorCode } from '@/constants/error-messages';
import { HTTP_STATUS } from '@/constants/http-status';

/**
 * Base class for expected, "operational" errors (bad input, missing resource, auth failure) —
 * as opposed to programmer errors/bugs. error.middleware.ts checks `isOperational` to decide
 * whether to return the error's own message (safe) or a generic one (unexpected exceptions
 * must never leak internals to the client — see ARCHITECTURE.md §17).
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly isOperational = true;
  public readonly details: unknown[];

  constructor(code: ErrorCode, statusCode: number, message?: string, details: unknown[] = []) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message?: string, details?: unknown[]) {
    super(ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST, message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message?: string) {
    super(ERROR_CODES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message?: string) {
    super(ERROR_CODES.FORBIDDEN, HTTP_STATUS.FORBIDDEN, message);
  }
}

/**
 * Distinct from `ForbiddenError` so the force-password-change gate (Prompt 10 § Part 6,
 * require-password-change.middleware.ts) is distinguishable from an ordinary permission
 * failure — a client can tell "you're not allowed" from "sign in again after changing
 * your password" apart, even though both currently surface as a 403 with only `message`
 * on the wire (see error.middleware.ts — the response envelope doesn't serialize `code` yet).
 */
export class PasswordChangeRequiredError extends AppError {
  constructor(message?: string) {
    super(ERROR_CODES.PASSWORD_CHANGE_REQUIRED, HTTP_STATUS.FORBIDDEN, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message?: string) {
    super(ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND, message);
  }
}

export class ConflictError extends AppError {
  constructor(message?: string) {
    super(ERROR_CODES.CONFLICT, HTTP_STATUS.CONFLICT, message);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message?: string) {
    super(ERROR_CODES.RATE_LIMITED, HTTP_STATUS.TOO_MANY_REQUESTS, message);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message?: string) {
    super(ERROR_CODES.SERVICE_UNAVAILABLE, HTTP_STATUS.SERVICE_UNAVAILABLE, message);
  }
}
