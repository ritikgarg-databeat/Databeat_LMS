import { disconnectDatabase, warmDatabasePool } from '@/config/prisma';
import { initScheduler, stopScheduler } from '@/jobs/scheduler';
import {
  initVideoGenerationWorker,
  stopVideoGenerationWorker,
} from '@/modules/video-generation/video-generation.worker';
import { logger } from '@/utils/logger';

let isShuttingDown = false;

async function bootstrap(): Promise<void> {
  await warmDatabasePool();
  initScheduler();
  initVideoGenerationWorker();
  logger.info('Databeat LMS background worker started');
}

function shutdown(signal: string): void {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`${signal} received — stopping background worker`);
  void Promise.all([stopScheduler(), stopVideoGenerationWorker()])
    .then(() => disconnectDatabase())
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      logger.error('Background worker shutdown failed', { error });
      process.exit(1);
    });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

void bootstrap().catch((error: unknown) => {
  logger.error('Background worker startup failed', { error });
  void disconnectDatabase().finally(() => process.exit(1));
});
