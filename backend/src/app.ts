import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Application } from 'express';
import helmet from 'helmet';

import { APP_CONFIG } from '@/config/app.config';
import { corsConfig } from '@/config/cors.config';
import { API_PREFIX } from '@/constants/routes';
import { errorMiddleware } from '@/middleware/error.middleware';
import { notFoundMiddleware } from '@/middleware/not-found.middleware';
import { rateLimiter } from '@/middleware/rate-limiter.middleware';
import { requestLogger } from '@/middleware/request-logger.middleware';
import routes from '@/routes';
import { sendSuccess } from '@/utils/api-response';

/**
 * Express app assembly. Middleware order matters: security headers and CORS first, then
 * body parsing, then logging/rate-limiting, then routes, then 404, then the error handler
 * last (Express only treats a 4-arg middleware as an error handler if it's registered last).
 */
export function createApp(): Application {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors(corsConfig));
  app.use(compression());
  app.use(express.json({ limit: APP_CONFIG.BODY_SIZE_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: APP_CONFIG.BODY_SIZE_LIMIT }));
  app.use(cookieParser());
  app.use(requestLogger);
  app.use(rateLimiter);

  app.get('/health', (_req, res) => {
    sendSuccess(res, { status: 'ok', timestamp: new Date().toISOString() }, 'Service is healthy');
  });

  app.use(API_PREFIX, routes);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
