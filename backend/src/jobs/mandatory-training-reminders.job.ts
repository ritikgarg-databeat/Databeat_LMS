import { notificationsService } from '@/modules/notifications/notifications.service';
import { logger } from '@/utils/logger';

export async function runMandatoryTrainingRemindersJob(): Promise<void> {
  try {
    const result = await notificationsService.runScheduledMandatoryTrainingReminders();
    logger.info('Mandatory training reminders job completed', result);
  } catch (error) {
    logger.error('Mandatory training reminders job failed', { error });
  }
}
