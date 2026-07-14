import type { QuestionCategory } from '@prisma/client';

/** Tunables for the dashboard module (Prompt 8 — trainee/trainer dashboard aggregation). */

/**
 * A category needs at least this many wrong answers (across the scope's attempts) before the
 * heuristic insight generator calls it out as a "weak topic". Below this, a single unlucky
 * question would produce a misleadingly specific-sounding claim from a tiny sample.
 */
export const MIN_WRONG_ANSWERS_FOR_WEAK_TOPIC = 2;

/** Max lines parsed out of an AI insights response — mirrors the "1-3 short tips" instruction. */
export const MAX_AI_INSIGHTS = 3;

/** How many `ContinueLearningItem`s the trainee dashboard surfaces. */
export const DASHBOARD_CONTINUE_LEARNING_LIMIT = 5;

/** How many not-yet-attempted, due-in-the-future assessments the trainee dashboard surfaces. */
export const DASHBOARD_UPCOMING_ASSESSMENTS_LIMIT = 5;

/** How many upcoming calendar events the trainee dashboard surfaces. */
export const DASHBOARD_UPCOMING_EVENTS_LIMIT = 5;

/** Lookahead window (from "now") for `upcomingEvents` — mirrors the frontend widget's own window. */
export const DASHBOARD_UPCOMING_EVENTS_WINDOW_DAYS = 30;

/** How many `recentResults` the trainee dashboard's assessments block surfaces. */
export const DASHBOARD_RECENT_RESULTS_LIMIT = 5;

/**
 * Human-readable labels for `QuestionCategory` (Prompt 8 § weak-topic insights). Deliberately
 * category-level ("SQL", "Data Analytics") — the schema has no finer-grained sub-topic tagging
 * (e.g. no way to say "SQL joins" specifically), so insights never claim more precision than
 * the data actually supports. See dashboard-insights.service.ts's doc comment.
 */
export const QUESTION_CATEGORY_LABELS: Record<QuestionCategory | 'UNKNOWN', string> = {
  PYTHON: 'Python',
  SQL: 'SQL',
  STATISTICS: 'Statistics',
  DATA_ANALYTICS: 'Data Analytics',
  MACHINE_LEARNING: 'Machine Learning',
  POWER_BI: 'Power BI',
  EXCEL: 'Excel',
  SPARK: 'Spark',
  HADOOP: 'Hadoop',
  GENERAL: 'General',
  UNKNOWN: 'General',
};
