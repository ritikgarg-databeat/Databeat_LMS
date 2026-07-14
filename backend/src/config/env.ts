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

const nodeEnv = readOptionalEnv('NODE_ENV', 'development');

export const env = {
  NODE_ENV: nodeEnv,
  PORT: Number(readOptionalEnv('PORT', '5000')),

  DATABASE_URL: readRequiredEnv('DATABASE_URL'),

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
    nodeEnv === 'production' ? readRequiredEnv('CORS_ORIGIN') : readOptionalEnv('CORS_ORIGIN', 'http://localhost:5173'),

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
} as const;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
