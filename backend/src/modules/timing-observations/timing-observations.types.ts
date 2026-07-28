export interface TimingObservationListFilters {
  lessonId?: string;
  courseId?: string;
  trainerId?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
}

export interface TimingObservationTrainerView {
  id: string;
  firstName: string;
  lastName: string;
}

export interface TimingObservationView {
  id: string;
  trainer: TimingObservationTrainerView;
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  manualDurationSeconds: number;
  aiAssistedDurationSeconds: number;
  savedSeconds: number;
  notes: string | null;
  createdAt: Date;
}

/** A single column's live-computed stats — explicit `null`s when `n` is 0, never a placeholder. */
export interface TimingStatSummary {
  mean: number | null;
  min: number | null;
  max: number | null;
}

/**
 * Stats are always computed from whatever rows currently match the request's filters — there is
 * no cached/precomputed version. `n`/`distinctTrainers`/`distinctLessons` are rendered
 * unconditionally alongside every mean in the frontend, per this feature's honesty requirement.
 */
export interface TimingObservationStats {
  n: number;
  distinctTrainers: number;
  distinctLessons: number;
  manual: TimingStatSummary;
  aiAssisted: TimingStatSummary;
  saved: TimingStatSummary;
}
