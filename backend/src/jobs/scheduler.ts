import cron from 'node-cron';

import { logger } from '@/utils/logger';

import { runDeadlineRemindersJob } from './deadline-reminders.job';

/** Once daily, comfortably inside the existing 48-hour `ASSESSMENT_DEADLINE_REMINDER_WINDOW_HOURS`
 * (constants/assessment.ts) — an assessment due within that window gets picked up on the very
 * next run even if this fires just after its window opened. */
const DEADLINE_REMINDERS_CRON_EXPRESSION = '0 6 * * *';

/**
 * The first background/interval-driven process in this codebase — everything else here (e.g.
 * notifications' lazy deadline check) is request-triggered, not time-triggered. Registers every
 * scheduled job; called once from server.ts on boot. `node-cron`'s own `shutdown()` (not tracked
 * task handles) stops every registered task in one call, used from server.ts's existing graceful
 * shutdown handler so a restart never leaves a dangling timer.
 */
export function initScheduler(): void {
  cron.schedule(DEADLINE_REMINDERS_CRON_EXPRESSION, () => void runDeadlineRemindersJob(), {
    name: 'deadline-reminders',
  });
  logger.info('Scheduler initialized', { jobs: ['deadline-reminders'] });
}

export async function stopScheduler(): Promise<void> {
  await cron.shutdown();
}
