/** True when lesson content was added after this learner last opened the lesson. */
export function hasNewLessonContent(
  latestResourceCreatedAt: Date | null | undefined,
  lastViewedAt: Date | null | undefined,
): boolean {
  if (!latestResourceCreatedAt) return false;
  if (!lastViewedAt) return true;
  return latestResourceCreatedAt.getTime() > lastViewedAt.getTime();
}
