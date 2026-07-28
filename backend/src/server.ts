import { createApp } from '@/app';
import { env } from '@/config/env';
import { initScheduler, stopScheduler } from '@/jobs/scheduler';
import { logger } from '@/utils/logger';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Databeat LMS API listening on port ${env.PORT} [${env.NODE_ENV}]`);
  initScheduler();
});

/** Lets in-flight requests finish before the process exits (e.g. on `docker stop`/CI). */
function shutdown(signal: string): void {
  logger.info(`${signal} received — shutting down gracefully`);
  void stopScheduler();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
