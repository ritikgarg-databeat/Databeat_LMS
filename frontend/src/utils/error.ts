import { isAxiosError } from 'axios';

import { DEFAULT_ERROR_MESSAGE, ERROR_MESSAGES } from '@/constants/error-messages';
import type { ApiErrorResponse } from '@/types/api';

/**
 * Normalizes any thrown value (AxiosError, Error, or unknown) into a single user-facing
 * string. Used by the Axios response interceptor and by feature-level error handling
 * (e.g. showing a toast) so error copy is derived consistently in exactly one place.
 */
export function getErrorMessage(error: unknown): string {
  if (isAxiosError<ApiErrorResponse>(error)) {
    if (!error.response) return ERROR_MESSAGES.NETWORK_ERROR ?? DEFAULT_ERROR_MESSAGE;
    return error.response.data?.message || DEFAULT_ERROR_MESSAGE;
  }

  if (error instanceof Error) return error.message;

  return DEFAULT_ERROR_MESSAGE;
}

/** Extracts per-field validation errors from the API envelope, keyed by field name. */
export function getFieldErrors(error: unknown): Record<string, string> {
  if (!isAxiosError<ApiErrorResponse>(error) || !error.response?.data?.errors) return {};

  return error.response.data.errors.reduce<Record<string, string>>((acc, fieldError) => {
    acc[fieldError.field] = fieldError.message;
    return acc;
  }, {});
}
