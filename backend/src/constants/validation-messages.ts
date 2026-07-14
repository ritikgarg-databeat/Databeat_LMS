/** Shared copy for express-validator `.withMessage()` calls, kept consistent across modules. */
export const VALIDATION_MESSAGES = {
  REQUIRED: (field: string) => `${field} is required.`,
  INVALID_EMAIL: 'Enter a valid email address.',
  MIN_LENGTH: (field: string, min: number) => `${field} must be at least ${min} characters.`,
  MAX_LENGTH: (field: string, max: number) => `${field} must be at most ${max} characters.`,
  INVALID_ID: (field: string) => `${field} must be a valid identifier.`,
} as const;
