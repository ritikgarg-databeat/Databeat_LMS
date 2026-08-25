import dotenv from 'dotenv';

dotenv.config();

/**
 * Single point of access for process.env. Importing `env` instead of `process.env` directly
 * means a missing required variable fails fast at startup with a clear message, rather than
 * surfacing later as a confusing runtime error (e.g. a Prisma connection failure with no context).
 */
function readRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}. Check your .env file.`);
  }
  return value;
}

function readOptionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function readVideoFrameConcurrency(): number | string {
  const value = readOptionalEnv('VIDEO_FRAME_CONCURRENCY', '50%').trim();
  const percentage = /^(\d{1,3})%$/.exec(value);
  if (percentage) {
    const numeric = Number(percentage[1]);
    if (numeric >= 1 && numeric <= 100) return `${numeric}%`;
  }
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 16) return numeric;
  throw new Error('VIDEO_FRAME_CONCURRENCY must be an integer from 1-16 or a percentage from 1%-100%.');
}

const nodeEnv = readOptionalEnv('NODE_ENV', 'development');

export const env = {
  NODE_ENV: nodeEnv,
  PORT: Number(readOptionalEnv('PORT', '5000')),
  TRUST_PROXY: readOptionalEnv('TRUST_PROXY', 'false'),
  RUN_SCHEDULER: readOptionalEnv('RUN_SCHEDULER', 'false') === 'true',
  RATE_LIMIT_STORE: readOptionalEnv('RATE_LIMIT_STORE', nodeEnv === 'production' ? 'postgres' : 'memory'),
  EXPIRED_SECURITY_DATA_RETENTION_DAYS: Number(readOptionalEnv('EXPIRED_SECURITY_DATA_RETENTION_DAYS', '30')),
  RUN_RETENTION_CLEANUP: readOptionalEnv('RUN_RETENTION_CLEANUP', 'false') === 'true',

  DATABASE_URL: readRequiredEnv('DATABASE_URL'),
  DATABASE_POOL_MAX: Number(readOptionalEnv('DATABASE_POOL_MAX', '4')),
  DATABASE_POOL_WARM_CONNECTIONS: Number(readOptionalEnv('DATABASE_POOL_WARM_CONNECTIONS', '4')),
  DATABASE_WORKER_POOL_MAX: Number(readOptionalEnv('DATABASE_WORKER_POOL_MAX', '1')),
  DATABASE_WORKER_POOL_WARM_CONNECTIONS: Number(
    readOptionalEnv('DATABASE_WORKER_POOL_WARM_CONNECTIONS', '1'),
  ),

  JWT_SECRET: readRequiredEnv('JWT_SECRET'),
  JWT_REFRESH_SECRET: readRequiredEnv('JWT_REFRESH_SECRET'),
  JWT_EXPIRES: readOptionalEnv('JWT_EXPIRES', '15m'),
  REFRESH_EXPIRES: readOptionalEnv('REFRESH_EXPIRES', '7d'),
  // "Remember me" (Prompt 9 § LOGIN EXPERIENCE) — a strict extension of the default session,
  // never shorter, so unchecked behavior is byte-for-byte what it was before this option existed.
  REFRESH_EXPIRES_REMEMBER_ME: readOptionalEnv('REFRESH_EXPIRES_REMEMBER_ME', '30d'),

  UPLOAD_PATH: readOptionalEnv('UPLOAD_PATH', './src/uploads'),

  // Required in production so a misconfigured/missing value fails loudly at boot instead of
  // silently falling back to the dev SPA's origin (which would misconfigure CORS for a real
  // deployment without any error — see cors.config.ts, which never allows a wildcard/reflected
  // origin regardless of this value). Dev/test keep the fallback so a bare `npm run dev` still
  // works without a .env override.
  CORS_ORIGIN:
    nodeEnv === 'production'
      ? readRequiredEnv('CORS_ORIGIN')
      : readOptionalEnv('CORS_ORIGIN', 'http://localhost:5173'),

  PASSWORD_RESET_URL: readOptionalEnv('PASSWORD_RESET_URL', 'http://localhost:5173/reset-password'),
  PASSWORD_RESET_EXPIRES_MINUTES: Number(readOptionalEnv('PASSWORD_RESET_EXPIRES_MINUTES', '30')),
  EMAIL_WEBHOOK_URL: readOptionalEnv('EMAIL_WEBHOOK_URL', ''),
  EMAIL_WEBHOOK_BEARER_TOKEN: readOptionalEnv('EMAIL_WEBHOOK_BEARER_TOKEN', ''),

  // Seed-only (backend/src/prisma/seed.ts) — the first Super Admin account created on a fresh
  // database. Override in any shared environment and change the password immediately after
  // first login (enforced server-side — see require-password-change.middleware.ts).
  ADMIN_EMAIL: readOptionalEnv('ADMIN_EMAIL', 'admin@lmsplatform.com'),
  ADMIN_PASSWORD: readOptionalEnv('ADMIN_PASSWORD', 'ChangeMe@123'),

  // Optional, not required: the AI Tutor (Prompt 7) is designed to degrade gracefully (503 on
  // /ai/chat) rather than fail the whole app at boot when no key is configured yet — see
  // src/modules/ai/index.ts, which picks the active AiProvider from AI_PROVIDER below.
  AI_PROVIDER: readOptionalEnv('AI_PROVIDER', 'openai'),
  ANTHROPIC_API_KEY: readOptionalEnv('ANTHROPIC_API_KEY', ''),
  AI_MODEL_ID: readOptionalEnv('AI_MODEL_ID', 'claude-opus-4-8'),
  MAIN_OPENAI_API_KEY: readOptionalEnv('MAIN_OPENAI_API_KEY', ''),
  MAIN_OPENAI_MODEL: readOptionalEnv('MAIN_OPENAI_MODEL', 'gpt-5.3-codex'),

  // Optional trainer video studio. It is disabled by default because rendering needs the
  // Remotion runtime plus explicit commercial-license approval for applicable organizations.
  VIDEO_GENERATION_ENABLED: readOptionalEnv('VIDEO_GENERATION_ENABLED', 'false') === 'true',
  VIDEO_STORYBOARD_MODEL: readOptionalEnv('VIDEO_STORYBOARD_MODEL', 'gpt-4o-mini'),
  VIDEO_TTS_MODEL: readOptionalEnv('VIDEO_TTS_MODEL', 'gpt-4o-mini-tts'),
  VIDEO_TRANSCRIPTION_MODEL: readOptionalEnv('VIDEO_TRANSCRIPTION_MODEL', 'whisper-1'),
  VIDEO_RENDER_CONCURRENCY: Number(readOptionalEnv('VIDEO_RENDER_CONCURRENCY', '1')),
  VIDEO_FRAME_CONCURRENCY: readVideoFrameConcurrency(),
  VIDEO_MAX_DURATION_SECONDS: Number(readOptionalEnv('VIDEO_MAX_DURATION_SECONDS', '480')),
  VIDEO_DRAFT_RETENTION_DAYS: Number(readOptionalEnv('VIDEO_DRAFT_RETENTION_DAYS', '7')),
  VIDEO_RENDER_TIMEOUT_MS: Number(readOptionalEnv('VIDEO_RENDER_TIMEOUT_MS', '900000')),
} as const;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
