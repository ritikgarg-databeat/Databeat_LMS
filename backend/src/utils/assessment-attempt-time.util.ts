export interface AssessmentAttemptWindow {
  startedAt: Date;
  durationMinutes: number;
  dueDate?: Date | null;
}

/** The attempt ends at the earlier of its own duration and the assessment due date. */
export function getAssessmentAttemptExpiresAt({
  startedAt,
  durationMinutes,
  dueDate,
}: AssessmentAttemptWindow): Date {
  const durationExpiry = new Date(startedAt.getTime() + durationMinutes * 60_000);
  if (!dueDate) return durationExpiry;
  return dueDate < durationExpiry ? dueDate : durationExpiry;
}

export function isAssessmentAttemptExpired(window: AssessmentAttemptWindow, now: Date = new Date()): boolean {
  return now >= getAssessmentAttemptExpiresAt(window);
}

export function getAssessmentAttemptElapsedSeconds(
  window: AssessmentAttemptWindow,
  now: Date = new Date(),
): number {
  const effectiveEnd =
    now < getAssessmentAttemptExpiresAt(window) ? now : getAssessmentAttemptExpiresAt(window);
  return Math.max(0, Math.round((effectiveEnd.getTime() - window.startedAt.getTime()) / 1000));
}
