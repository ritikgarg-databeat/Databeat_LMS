import { Flame } from 'lucide-react';

import { ProgressMeter } from '@/features/analytics/components';
import type { TraineeWelcome } from '@/features/analytics/types';

export interface TraineeWelcomeHeaderProps {
  welcome: TraineeWelcome;
}

/** Builds the "department · groups" subtitle, omitting either side when absent. */
function buildSubtitle(welcome: TraineeWelcome): string | null {
  const parts: string[] = [];
  if (welcome.departmentName) parts.push(welcome.departmentName);
  if (welcome.groupNames.length > 0) parts.push(welcome.groupNames.join(', '));
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Trainee dashboard header — NOT a card, sits directly on the page background. Left side is the
 * greeting + department/group subtitle; right side surfaces the streak (graceful zero-state) and
 * overall completion at a glance.
 */
function TraineeWelcomeHeader({ welcome }: TraineeWelcomeHeaderProps) {
  const subtitle = buildSubtitle(welcome);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {welcome.name}</h1>
        {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <div className="flex items-center gap-1.5 text-sm">
          <Flame
            className={welcome.streakDays > 0 ? 'size-4 text-warning' : 'size-4 text-muted-foreground'}
            aria-hidden
          />
          <span className={welcome.streakDays > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}>
            {welcome.streakDays > 0 ? `${welcome.streakDays}-day streak` : 'Start your streak today'}
          </span>
        </div>
        <ProgressMeter
          value={welcome.overallCompletionPercentage}
          label="Overall completion"
          className="w-56"
        />
      </div>
    </div>
  );
}

export { TraineeWelcomeHeader };
