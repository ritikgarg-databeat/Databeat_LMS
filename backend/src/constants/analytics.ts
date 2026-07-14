/** Tunables for the analytics module (Prompt 8 — Learning Progress Engine). */

/**
 * Freshness window for every analytics cache table (UserDailyActivity, UserPerformanceSnapshot,
 * CourseAnalyticsSnapshot, AssessmentAnalyticsSnapshot). A snapshot whose `computedAt` is older
 * than this is lazily recomputed on access — see aggregation.service.ts.
 */
export const ANALYTICS_SNAPSHOT_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** How many trailing UTC calendar days of UserDailyActivity a per-user recompute backfills. */
export const ANALYTICS_ACTIVITY_WINDOW_DAYS = 90;

/** How far back learning-streak computation reads UserDailyActivity dates. */
export const ANALYTICS_STREAK_LOOKBACK_DAYS = 366;

/** Length (days) of the group activity timeline returned by `GET /analytics/groups/:id`. */
export const ANALYTICS_TIMELINE_DAYS = 30;

export const LEADERBOARD_DEFAULT_LIMIT = 20;
export const LEADERBOARD_MAX_LIMIT = 100;
