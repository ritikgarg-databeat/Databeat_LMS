import cron from 'node-cron';

import { env } from '@/config/env';
import { logger } from '@/utils/logger';

import { runDeadlineRemindersJob } from './deadline-reminders.job';
import { runExpiredAssessmentAttemptsJob } from './expired-assessment-attempts.job';
import { runMandatoryTrainingRemindersJob } from './mandatory-training-reminders.job';
import { runSecurityDataRetentionJob } from './security-data-retention.job';

/** Once daily, comfortably inside the existing 48-hour `ASSESSMENT_DEADLINE_REMINDER_WINDOW_HOURS`
 * (constants/assessment.ts) — an assessment due within that window gets picked up on the very
 * next run even if this fires just after its window opened. */
const DEADLINE_REMINDERS_CRON_EXPRESSION = '0 6 * * *';
const EXPIRED_ASSESSMENT_ATTEMPTS_CRON_EXPRESSION = '* * * * *';
const SECURITY_DATA_RETENTION_CRON_EXPRESSION = '0 3 * * *';
const MANDATORY_TRAINING_REMINDERS_CRON_EXPRESSION = '30 6 * * *';

/**
 * The first background/interval-driven process in this codebase — everything else here (e.g.
 * notifications' lazy deadline check) is request-triggered, not time-triggered. Registers every
 * scheduled job; called once from server.ts on boot. `node-cron`'s own `shutdown()` (not tracked
 * task handles) stops every registered task in one call, used from server.ts's existing graceful
 * shutdown handler so a restart never leaves a dangling timer.
 */
export function initScheduler(): void {
  const expiredAttemptsTask = cron.schedule(
    EXPIRED_ASSESSMENT_ATTEMPTS_CRON_EXPRESSION,
    () => runExpiredAssessmentAttemptsJob(),
    {
      name: 'expired-assessment-attempts',
      noOverlap: true,
    },
  );
  const deadlineRemindersTask = cron.schedule(
    DEADLINE_REMINDERS_CRON_EXPRESSION,
    () => runDeadlineRemindersJob(),
    {
      name: 'deadline-reminders',
      noOverlap: true,
    },
  );
  const mandatoryTrainingRemindersTask = cron.schedule(
    MANDATORY_TRAINING_REMINDERS_CRON_EXPRESSION,
    () => runMandatoryTrainingRemindersJob(),
    { name: 'mandatory-training-reminders', noOverlap: true },
  );

  // Catch up immediately after worker downtime instead of waiting for the next minute/day tick.
  // Both jobs are idempotent, and executing the scheduled task itself preserves no-overlap rules.
  void expiredAttemptsTask.execute();
  void deadlineRemindersTask.execute();
  void mandatoryTrainingRemindersTask.execute();

  const jobs = ['expired-assessment-attempts', 'deadline-reminders', 'mandatory-training-reminders'];
  if (env.RUN_RETENTION_CLEANUP) {
    cron.schedule(SECURITY_DATA_RETENTION_CRON_EXPRESSION, () => runSecurityDataRetentionJob(), {
      name: 'security-data-retention',
      noOverlap: true,
    });
    jobs.push('security-data-retention');
  }
  logger.info('Scheduler initialized', { jobs });
}

export async function stopScheduler(): Promise<void> {
  await cron.shutdown();
}
