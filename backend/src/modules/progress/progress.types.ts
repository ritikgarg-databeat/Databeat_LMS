import type { LessonProgressStatus } from '@prisma/client';

// Internal domain types for the progress module.

export interface LessonProgressView {
  status: LessonProgressStatus;
  timeSpentSeconds: number;
  lastViewedAt: Date | null;
  completedAt: Date | null;
}

export interface ContinueLearningItem {
  lessonId: string;
  lessonTitle: string;
  moduleId: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  status: LessonProgressStatus;
  timeSpentSeconds: number;
  lastViewedAt: Date | null;
}

export interface ProgressSummary {
  assignedCoursesCount: number;
  overallCompletionPercentage: number;
  completedLessonsCount: number;
  totalLessonsCount: number;
  hoursSpent: number;
}

export interface CourseLessonProgress {
  lessonId: string;
  title: string;
  status: LessonProgressStatus;
  timeSpentSeconds: number;
}

export interface CourseModuleProgress {
  moduleId: string;
  title: string;
  percentage: number;
  lessons: CourseLessonProgress[];
}

export interface CourseProgressBreakdown {
  courseId: string;
  overallPercentage: number;
  modules: CourseModuleProgress[];
}
