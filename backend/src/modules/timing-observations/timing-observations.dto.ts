export interface CreateTimingObservationDto {
  lessonId: string;
  courseId: string;
  manualDurationSeconds: number;
  aiAssistedDurationSeconds: number;
  notes?: string;
}

export interface ListTimingObservationsQueryDto {
  lessonId?: string;
  courseId?: string;
  trainerId?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  page?: string;
  pageSize?: string;
}

export type StatsTimingObservationsQueryDto = Omit<ListTimingObservationsQueryDto, 'page' | 'pageSize'>;
