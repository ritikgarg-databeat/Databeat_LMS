import rateLimit from 'express-rate-limit';

import { APP_CONFIG } from '@/config/app.config';
import { ERROR_CODES, ERROR_MESSAGES } from '@/constants/error-messages';
import { HTTP_STATUS } from '@/constants/http-status';

/**
 * General-purpose limiter applied to every request in app.ts. Stricter, endpoint-specific
 * limiters (e.g. on /auth/login, /ai/*) are added per module as those modules are built —
 * see ARCHITECTURE.md §17. This is the baseline, not the final rate-limiting strategy.
 */
export const rateLimiter = rateLimit({
  windowMs: APP_CONFIG.RATE_LIMIT_WINDOW_MS,
  limit: APP_CONFIG.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      message: ERROR_MESSAGES[ERROR_CODES.RATE_LIMITED],
      errors: [],
    });
  },
});
