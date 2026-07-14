/** Shared copy for Zod `.min()/.email()/...` custom error messages, kept consistent across forms. */
export const VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required.',
  INVALID_EMAIL: 'Enter a valid email address.',
  MIN_LENGTH: (min: number) => `Must be at least ${min} characters.`,
  MAX_LENGTH: (max: number) => `Must be at most ${max} characters.`,
  PASSWORDS_DO_NOT_MATCH: 'Passwords do not match.',
} as const;
