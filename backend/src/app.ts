import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Application, type Request, type Response } from 'express';
import helmet from 'helmet';

import { APP_CONFIG } from '@/config/app.config';
import { corsConfig } from '@/config/cors.config';
import { env } from '@/config/env';
import { prisma } from '@/config/prisma';
import { API_PREFIX } from '@/constants/routes';
import { errorMiddleware } from '@/middleware/error.middleware';
import { notFoundMiddleware } from '@/middleware/not-found.middleware';
import { rateLimiter } from '@/middleware/rate-limiter.middleware';
import { requestIdMiddleware } from '@/middleware/request-id.middleware';
import { requestLogger } from '@/middleware/request-logger.middleware';
import routes from '@/routes';
import { storageProvider } from '@/storage';
import { sendError, sendSuccess } from '@/utils/api-response';

function trustProxySetting(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

async function readinessHandler(_req: Request, res: Response): Promise<void> {
  try {
    await Promise.all([prisma.$queryRaw`SELECT 1`, storageProvider.checkHealth()]);
    sendSuccess(res, { status: 'ready', timestamp: new Date().toISOString() }, 'Service is ready');
  } catch {
    sendError(res, 'Service is not ready', [], 503);
  }
}

/**
 * Express app assembly. Middleware order matters: security headers and CORS first, then
 * body parsing, then logging/rate-limiting, then routes, then 404, then the error handler
 * last (Express only treats a 4-arg middleware as an error handler if it's registered last).
 */
export function createApp(): Application {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', trustProxySetting(env.TRUST_PROXY));
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(cors(corsConfig));
  app.use(compression());
  app.use(express.json({ limit: APP_CONFIG.BODY_SIZE_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: APP_CONFIG.BODY_SIZE_LIMIT }));
  app.use(cookieParser());
  app.use(requestLogger);
  app.use(rateLimiter);

  app.get('/health/live', (_req, res) => {
    sendSuccess(res, { status: 'alive', timestamp: new Date().toISOString() }, 'Service is alive');
  });
  app.get('/health/ready', readinessHandler);
  app.get('/health', readinessHandler);

  app.use(API_PREFIX, routes);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
