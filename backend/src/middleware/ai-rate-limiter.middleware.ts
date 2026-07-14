import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { AI_RATE_LIMIT_MAX_REQUESTS, AI_RATE_LIMIT_WINDOW_MS } from '@/constants/ai';
import { ERROR_CODES, ERROR_MESSAGES } from '@/constants/error-messages';
import { HTTP_STATUS } from '@/constants/http-status';

/**
 * Stricter than the app-wide rate limiter (ARCHITECTURE.md §17) — every request here is a
 * real, billed LLM call. Keyed by user id (not IP, unlike loginRateLimiter) since this sits
 * behind `authenticate`, so `req.user` is always populated by the time this middleware runs —
 * the `req.ip` branch is an unreachable-in-practice fallback, kept only so the middleware
 * degrades safely if it's ever mounted without `authenticate` ahead of it. Must route that
 * fallback through `ipKeyGenerator` (not a raw `req.ip` string), or express-rate-limit v8 logs
 * an `ERR_ERL_KEY_GEN_IPV6` warning on startup — a bare IP string doesn't normalize IPv6
 * addresses, so different suffixes of the same /64 would each get their own limit bucket.
 */
export const aiRateLimiter = rateLimit({
  windowMs: AI_RATE_LIMIT_WINDOW_MS,
  limit: AI_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? ipKeyGenerator(req.ip ?? 'unknown'),
  handler: (_req, res) => {
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      message: ERROR_MESSAGES[ERROR_CODES.RATE_LIMITED],
      errors: [],
    });
  },
});
