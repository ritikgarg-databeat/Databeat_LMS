import type { LessonProgressStatus } from '@prisma/client';

// Internal domain types for the progress module.

export interface LessonProgressView {
  status: LessonProgressStatus;
  timeSpentSeconds: number;
  lastViewedAt: Date | null;
  completedAt: Date | null;
  completedContentVersion: number | null;
  currentContentVersion: number;
  hasNewContent: boolean;
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
  hasNewContent: boolean;
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
  hasNewContent: boolean;
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
