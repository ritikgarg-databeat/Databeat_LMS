/**
 * Environment helper. The actual env-reading/validation logic lives in `config/env.ts`
 * (env vars are configuration, not a utility) — this file re-exports the pieces other
 * utils/services commonly need, so callers can `import { isProduction } from '@/utils'`
 * without reaching into `config` directly and without duplicating the parsing logic.
 */
export { env, isProduction, isDevelopment, isTest } from '@/config/env';
