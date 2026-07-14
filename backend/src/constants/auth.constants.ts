/**
 * Password policy (ARCHITECTURE.md §17): minimum 8 characters, at least one uppercase,
 * one lowercase, one digit, and one special character. Mirrored on the frontend in
 * `features/auth/utils/password-policy.ts` — keep both in sync if this changes.
 */
export const PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const PASSWORD_POLICY_DESCRIPTION =
  'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.';

export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10;
