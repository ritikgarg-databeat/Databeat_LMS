/**
 * Single point of access for build-time environment variables. Importing `env` instead of
 * `import.meta.env` directly means a missing/misnamed variable fails fast at startup with a
 * clear message, rather than surfacing later as a confusing network error.
 */
function readRequiredEnv(key: keyof ImportMetaEnv): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}. Check your .env file.`);
  }
  return value;
}

export const env = {
  API_URL: readRequiredEnv('VITE_API_URL'),
  MODE: import.meta.env.MODE,
  IS_DEV: import.meta.env.DEV,
  IS_PROD: import.meta.env.PROD,
} as const;
