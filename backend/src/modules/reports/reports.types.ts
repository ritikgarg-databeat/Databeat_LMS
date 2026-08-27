import type { LessonProgressStatus, Role } from '@prisma/client';

// Internal domain types for the reports module.

/**
 * The authenticated caller (`req.user`). Routes gate on TRAINER/SUPER_ADMIN (see
 * reports.routes.ts) before any service method runs, so a TRAINEE never reaches the service.
 */
export interface ReportActor {
  id: string;
  role: Role;
}

/** What every export service method returns — the controller turns it into a CSV download. */
export interface CsvExport {
  filename: string;
  csv: string;
}

/** A PUBLISHED, non-deleted course a user can access via a group membership. */
export interface AccessibleCourse {
  id: string;
  title: string;
  isMandatory: boolean;
}

/** One user's recorded progress on one lesson (the subset of LessonProgress the reports need). */
export interface LessonProgressCell {
  status: LessonProgressStatus;
  completedContentVersion: number | null;
  timeSpentSeconds: number;
  lastViewedAt: Date | null;
}

/**
 * Everything needed to compute completion / time-spent / last-activity figures for a set of
 * users, loaded in a fixed number of batched queries — see
 * `ReportsService#loadProgressComputation`.
 */
export interface ProgressComputation {
  /** Accessible courses per user (deduped; unordered — callers sort for presentation). */
  coursesByUser: Map<string, AccessibleCourse[]>;
  /** Published lessons (in published modules) per course — the completion denominator. */
  lessonIdsByCourse: Map<string, string[]>;
  /** Current content version per published lesson, used to reject stale completions. */
  lessonVersionById: Map<string, number>;
  /** userId → lessonId → progress row. Absent entries mean NOT_STARTED / no time recorded. */
  progressByUser: Map<string, Map<string, LessonProgressCell>>;
}
