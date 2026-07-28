import { notificationsService } from '@/modules/notifications/notifications.service';
import { logger } from '@/utils/logger';

/**
 * Thin wrapper around `notificationsService.runScheduledDeadlineReminders()` for the cron
 * scheduler (jobs/scheduler.ts) to call. A background job must never crash the process — mirrors
 * `auditLogService.record()`'s own try/catch-and-log precedent (services/audit-log.service.ts):
 * a failure here is logged, not thrown, so one bad run never takes the server down or blocks
 * whatever else node-cron has scheduled.
 */
export async function runDeadlineRemindersJob(): Promise<void> {
  try {
    const result = await notificationsService.runScheduledDeadlineReminders();
    logger.info('Deadline reminders job completed', result);
  } catch (error) {
    logger.error('Deadline reminders job failed', { error });
  }
}
