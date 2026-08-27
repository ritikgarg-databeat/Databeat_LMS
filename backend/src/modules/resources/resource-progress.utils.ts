import type { ResourceType } from '@prisma/client';

export type WatchedInterval = [number, number];

/** Never credit more active time than elapsed server time between progress events. */
export function cappedActiveSecondsDelta(
  reportedSeconds: number,
  previousEventAt: Date | null | undefined,
  now: Date,
): number {
  if (!previousEventAt) return 0;
  const elapsedSeconds = Math.max(0, (now.getTime() - previousEventAt.getTime()) / 1000);
  return Math.min(reportedSeconds, 15, Math.ceil(elapsedSeconds + 1));
}

export function requiredResourceActiveSeconds(type: ResourceType, content: string | null): number {
  if (type === 'MARKDOWN' || type === 'CODE_SNIPPET') {
    const words = (content ?? '').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(10, Math.min(180, Math.ceil((words / 200) * 60)));
  }
  if (type === 'IMAGE') return 5;
  if (type === 'PDF' || type === 'PRESENTATION' || type === 'DOCUMENT') return 30;
  return 10;
}

export function mergeWatchedIntervals(intervals: WatchedInterval[]): WatchedInterval[] {
  const ordered = intervals.filter(([from, to]) => to >= from).sort((a, b) => a[0] - b[0]);
  const merged: WatchedInterval[] = [];
  for (const interval of ordered) {
    const previous = merged[merged.length - 1];
    if (!previous || interval[0] > previous[1] + 0.5) merged.push([...interval]);
    else previous[1] = Math.max(previous[1], interval[1]);
  }
  return merged;
}

export function watchedDuration(intervals: WatchedInterval[]): number {
  return intervals.reduce((sum, [from, to]) => sum + Math.max(0, to - from), 0);
}

export function isVideoProgressComplete(input: {
  durationSeconds: number | null;
  furthestSecond: number;
  activeTimeSeconds: number;
  intervals: WatchedInterval[];
}): boolean {
  const duration = input.durationSeconds;
  if (!duration || duration <= 0) return false;
  return (
    watchedDuration(input.intervals) / duration >= 0.95 &&
    input.furthestSecond / duration >= 0.95 &&
    input.activeTimeSeconds / duration >= 0.9
  );
}
