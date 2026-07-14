/** App-wide, non-secret configuration values that aren't environment-specific. */
export const APP_CONFIG = {
  BCRYPT_SALT_ROUNDS: 12,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  BODY_SIZE_LIMIT: '10mb',
  // Global, IP-keyed backstop against gross volumetric abuse — NOT the primary brute-force/
  // cost-control defense (that's the endpoint-specific `loginRateLimiter`/`aiRateLimiter`,
  // src/middleware/, tuned much tighter). 100 req/15min proved too low for real usage: a single
  // dashboard-heavy page load in this SPA fires well over a dozen parallel requests, and this
  // limiter is keyed by IP, so any shared corporate/NAT egress IP multiplies that across every
  // concurrent user. Raised to a ceiling that still bounds scraping/DoS-style abuse without
  // false-positiving on legitimate multi-user, multi-widget traffic.
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
  RATE_LIMIT_MAX_REQUESTS: 300,
} as const;
