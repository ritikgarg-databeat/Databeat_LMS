import { createApp } from '@/app';
import { env } from '@/config/env';
import { disconnectDatabase, warmDatabasePool } from '@/config/prisma';
import { initScheduler, stopScheduler } from '@/jobs/scheduler';
import { settingsService } from '@/modules/settings/settings.service';
import { logger } from '@/utils/logger';

const app = createApp();
let server: ReturnType<typeof app.listen> | null = null;
let isShuttingDown = false;

async function bootstrap(): Promise<void> {
  const startedAt = Date.now();
  await warmDatabasePool();
  await settingsService.isMaintenanceModeActive();
  logger.info('Database connection pool and platform settings ready', {
    durationMs: Date.now() - startedAt,
  });

  server = app.listen(env.PORT, () => {
    logger.info(`Databeat LMS API listening on port ${env.PORT} [${env.NODE_ENV}]`);
    if (env.RUN_SCHEDULER) initScheduler();
  });
}

async function finishShutdown(signal: string): Promise<void> {
  if (env.RUN_SCHEDULER) await stopScheduler();
  await disconnectDatabase();
  logger.info(`${signal} shutdown complete`);
}

function shutdown(signal: string): void {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`${signal} received — shutting down gracefully`);

  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out; forcing exit.');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  const finish = () => {
    void finishShutdown(signal)
      .then(() => {
        clearTimeout(forceExitTimer);
        process.exit(0);
      })
      .catch((error: unknown) => {
        logger.error('Graceful shutdown failed', { error });
        process.exit(1);
      });
  };

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      finish();
    });
  } else {
    finish();
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

void bootstrap().catch((error: unknown) => {
  logger.error('API startup failed', { error });
  void disconnectDatabase().finally(() => process.exit(1));
});
