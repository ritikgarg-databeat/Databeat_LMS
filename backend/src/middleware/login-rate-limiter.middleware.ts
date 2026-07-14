import rateLimit from 'express-rate-limit';

import { LOGIN_RATE_LIMIT_MAX_ATTEMPTS, LOGIN_RATE_LIMIT_WINDOW_MS } from '@/constants/auth.constants';
import { ERROR_CODES, ERROR_MESSAGES } from '@/constants/error-messages';
import { HTTP_STATUS } from '@/constants/http-status';

/**
 * Stricter than the app-wide rate limiter (ARCHITECTURE.md §17) — brute-force protection
 * specifically on the login endpoint, keyed by IP.
 */
export const loginRateLimiter = rateLimit({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  limit: LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      message: ERROR_MESSAGES[ERROR_CODES.RATE_LIMITED],
      errors: [],
    });
  },
});
