import path from 'node:path';

import winston from 'winston';

import { isProduction } from '@/config/env';

// Anchored on process.cwd() (the backend package root, however the process was started),
// NOT __dirname — __dirname would resolve to src/utils under ts-node but dist/utils once
// built, silently splitting logs across two locations (and losing prod logs on every
// `rimraf dist` rebuild). Requires the process to be started from the backend package root,
// which is how every script in package.json invokes it.
const LOGS_DIR = path.join(process.cwd(), 'src', 'logs');

/**
 * App-wide structured logger (INFO/WARN/ERROR/DEBUG). Logs to files under src/logs/ so they're
 * kept separate from application code, plus the console in non-production environments.
 * Import this everywhere instead of `console.log` — Morgan (HTTP access logs) is wired
 * to pipe through this same logger in app.ts, so all output goes through one place.
 */
export const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({ filename: path.join(LOGS_DIR, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(LOGS_DIR, 'combined.log') }),
  ],
});

if (!isProduction) {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  );
}
