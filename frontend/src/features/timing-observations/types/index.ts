export interface TimingObservationTrainer {
  id: string;
  firstName: string;
  lastName: string;
}

export interface TimingObservation {
  id: string;
  trainer: TimingObservationTrainer;
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  manualDurationSeconds: number;
  aiAssistedDurationSeconds: number;
  savedSeconds: number;
  notes: string | null;
  createdAt: string;
}

export interface TimingObservationListFilters {
  lessonId?: string;
  courseId?: string;
  trainerId?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
}

export interface TimingObservationListParams extends TimingObservationListFilters {
  page: number;
  pageSize: number;
}

export interface TimingStatSummary {
  mean: number | null;
  min: number | null;
  max: number | null;
}

export interface TimingObservationStats {
  n: number;
  distinctTrainers: number;
  distinctLessons: number;
  manual: TimingStatSummary;
  aiAssisted: TimingStatSummary;
  saved: TimingStatSummary;
}

export interface CreateTimingObservationPayload {
  lessonId: string;
  courseId: string;
  manualDurationSeconds: number;
  aiAssistedDurationSeconds: number;
  notes?: string;
}
