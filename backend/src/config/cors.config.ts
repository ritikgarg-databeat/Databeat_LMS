import type { CorsOptions } from 'cors';

import { env } from '@/config/env';

/**
 * `credentials: true` is required because the (future) refresh token travels as an
 * httpOnly cookie (ARCHITECTURE.md §9) — that only works with an explicit origin allowlist,
 * never `origin: '*'`.
 */
export const corsConfig: CorsOptions = {
  origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
  credentials: true,
};
