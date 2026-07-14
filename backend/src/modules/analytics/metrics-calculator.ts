/**
 * Pure metric math for the analytics module — no Prisma, no I/O, no clock reads ("today" is
 * always passed in), so every function here is trivially unit-testable. aggregation.service.ts
 * and analytics.service.ts are the intended consumers.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Rounds to one decimal place — the precision every stored/returned analytics rate uses. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** `part / whole` as a 0–100 percentage rounded to 1dp; 0 (not NaN) when `whole` is 0. */
export function percentage(part: number, whole: number): number {
  if (whole === 0) return 0;
  return round1((part / whole) * 100);
}

/** Arithmetic mean, or null for an empty list (keeps "no data" distinguishable from 0). */
export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Formats a Date as its UTC calendar day, 'YYYY-MM-DD' — the module's canonical day key. */
export function toUtcDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses a 'YYYY-MM-DD' day key into a Date at UTC midnight (what `@db.Date` columns store). */
export function utcDayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** Shifts a 'YYYY-MM-DD' day key by `delta` whole days (negative = into the past). */
export function addUtcDays(day: string, delta: number): string {
  return toUtcDayString(new Date(utcDayToDate(day).getTime() + delta * MS_PER_DAY));
}

/**
 * Length of the user's current learning streak: consecutive UTC days with activity ending
 * today OR yesterday — an unbroken run whose latest day is yesterday still counts as a live
 * streak (the user simply hasn't been active *yet* today).
 *
 * @param activityDates set of 'YYYY-MM-DD' UTC day keys that have any recorded activity.
 * @param todayUtc the current UTC day as 'YYYY-MM-DD' (passed in to keep this pure).
 */
export function computeStreakDays(activityDates: Set<string>, todayUtc: string): number {
  let cursor = activityDates.has(todayUtc) ? todayUtc : addUtcDays(todayUtc, -1);
  let streak = 0;
  while (activityDates.has(cursor)) {
    streak += 1;
    cursor = addUtcDays(cursor, -1);
  }
  return streak;
}

/**
 * THE composite 0–100 ranking score used by the leaderboard and every UserPerformanceSnapshot —
 * the single place this formula may ever change (the snapshot column's schema doc comment
 * points here):
 *
 *     0.5 * completionPercentage
 *   + 0.4 * (averageScore ?? 0)
 *   + 0.1 * (min(activityEvents7d, 20) / 20 * 100)
 *
 * rounded to 1dp. The activity term saturates at 20 events/week so grinding activity alone can
 * never dominate genuine completion/score performance.
 */
export function computePerformanceScore(input: {
  completionPercentage: number;
  averageScore: number | null;
  activityEvents7d: number;
}): number {
  const activityComponent = (Math.min(input.activityEvents7d, 20) / 20) * 100;
  return round1(0.5 * input.completionPercentage + 0.4 * (input.averageScore ?? 0) + 0.1 * activityComponent);
}

/**
 * Per-step drop-off for an ordered funnel of completion rates (0–100 each): how many percentage
 * points each step lost versus the previous step, floored at 0 (a step that outperforms its
 * predecessor drops 0 — it never "gains"). The first step drops relative to 100.
 */
export function computeDropOff(orderedRates: number[]): number[] {
  return orderedRates.map((rate, index) => {
    const previous = index === 0 ? 100 : (orderedRates[index - 1] ?? 100);
    return Math.max(0, round1(previous - rate));
  });
}
