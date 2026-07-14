/** Stable, machine-readable error codes returned in the API error envelope (ARCHITECTURE.md §11/§17). */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  // Force-password-change gate (Prompt 10 § Part 6) — distinct from FORBIDDEN so the
  // (currently message-based, see error.middleware.ts) client signal is unambiguous even
  // though `AppError.code` itself isn't yet serialized into the wire response envelope.
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Default human-readable messages, used when a call site doesn't supply a more specific one. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Please check the submitted data and try again.',
  UNAUTHORIZED: 'Authentication is required to access this resource.',
  FORBIDDEN: "You don't have permission to perform this action.",
  NOT_FOUND: 'The requested resource could not be found.',
  CONFLICT: 'This action conflicts with existing data.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again shortly.',
  SERVICE_UNAVAILABLE: 'This feature is temporarily unavailable. Please try again shortly.',
  PASSWORD_CHANGE_REQUIRED: 'You must change your password before continuing.',
};
