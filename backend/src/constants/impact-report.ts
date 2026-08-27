/**
 * The single honesty gate every Impact Report figure passes through (classifyConfidence in
 * modules/impact-metrics/impact-metrics.service.ts) — Checkpoint 1 feedback marked "Measurable
 * Early Impact" down specifically for calling a number "validated" before it was. These three
 * thresholds are the only place that word is allowed to trigger; every other call site defers to
 * classifyConfidence rather than checking counts itself.
 */
export const MIN_N_FOR_VALIDATED = 10;
export const MIN_DISTINCT_TRAINERS_FOR_VALIDATED = 3;
export const MIN_PILOT_DAYS_FOR_VALIDATED = 3;

/** Below this many observations, a mean is shown with a low-sample-size badge rather than as a
 * settled number — applies to every report in the timing-observations and impact-metrics modules. */
export const LOW_SAMPLE_THRESHOLD = 20;

export type ImpactConfidence = 'validated' | 'measured' | 'insufficient';

/**
 * `distinctActors` generalizes "distinct trainers" to whichever population of real people stands
 * behind the `n` observations for a given metric — trainers for TimingObservation, distinct
 * trainees for auto-grading/AI-quiz-gen latency, distinct actors for CSV-import speed. The point
 * is the same for all of them: one person's one example never counts as "validated", no matter
 * how large `n` gets by re-running the same person's same action.
 * `spanDays` is the number of distinct calendar days the observations span — a pilot that ran
 * for one afternoon isn't "validated" just because it logged ten rows in an hour.
 */
export function classifyConfidence(n: number, distinctActors: number, spanDays: number): ImpactConfidence {
  if (n === 0) return 'insufficient';
  if (
    n >= MIN_N_FOR_VALIDATED &&
    distinctActors >= MIN_DISTINCT_TRAINERS_FOR_VALIDATED &&
    spanDays >= MIN_PILOT_DAYS_FOR_VALIDATED
  ) {
    return 'validated';
  }
  return 'measured';
}
