/** A trainer's free-text note on one timing observation (e.g. "harder lesson, more edits"). */
export const MAX_TIMING_OBSERVATION_NOTES_LENGTH = 1000;

/** Sanity ceiling on a single reported duration (4 hours) — catches an obvious data-entry
 * mistake (e.g. minutes typed into a seconds field) without guessing at a "normal" range. */
export const MAX_TIMING_OBSERVATION_DURATION_SECONDS = 4 * 60 * 60;

/** Below this many observations, the frontend/report layer shows a low-sample-size badge next
 * to any computed average rather than presenting it as a settled number. */
export const TIMING_OBSERVATION_LOW_SAMPLE_THRESHOLD = 20;
