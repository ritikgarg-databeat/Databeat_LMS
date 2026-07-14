/**
 * Fallback, user-facing copy for known error codes returned by the API error envelope
 * (see ARCHITECTURE.md §11). Keyed by the same `code` the backend sends, so the API layer
 * can look up a friendly message when the backend didn't provide one.
 */
export const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Your session has expired. Please sign in again.',
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: 'The requested resource could not be found.',
  VALIDATION_ERROR: 'Please check the highlighted fields and try again.',
  CONFLICT: 'This action conflicts with existing data.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again shortly.',
  NETWORK_ERROR: 'Unable to reach the server. Check your connection and try again.',
};

export const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.';
