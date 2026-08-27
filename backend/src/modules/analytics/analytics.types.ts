import type {
  AssessmentAttemptStatus,
  AssessmentStatus,
  CourseStatus,
  GroupStatus,
  QuestionCategory,
  QuestionDifficulty,
  QuestionType,
} from '@prisma/client';

// Internal domain types + response shapes for the analytics module. These double as the
// module's published types (re-exported from index.ts) — other modules and the frontend
// contract depend on them, so treat renames as breaking changes.

/** One zero-fillable day of activity counts — mirrors UserDailyActivity's count columns. */
export interface DailyActivityPoint {
  /** UTC calendar day, 'YYYY-MM-DD'. */
  date: string;
  logins: number;
  lessonsCompleted: number;
  assessmentsSubmitted: number;
  aiMessages: number;
  qnaPosts: number;
}

export interface GroupsAnalyticsFilters {
  departmentId?: string;
}

/** One row of `GET /analytics/groups` — a group aggregated over its trainee members' snapshots. */
export interface GroupAnalyticsRow {
  groupId: string;
  name: string;
  code: string;
  status: GroupStatus;
  departmentName: string;
  traineeCount: number;
  /** Mean of member snapshots' completionPercentage; 0 when the group has no trainees. */
  completionPercentage: number;
  /** Mean of members' non-null averageScores; null when no member has a scored attempt. */
  averageScore: number | null;
  /** Members whose lastActivityAt falls within the trailing 7 days. */
  activeUsers7d: number;
  lastActivityAt: Date | null;
}

export interface GroupMemberAnalyticsRow {
  userId: string;
  name: string;
  email: string;
  completionPercentage: number;
  averageScore: number | null;
  lessonsCompleted: number;
  assessmentsTaken: number;
  lastActivityAt: Date | null;
  performanceScore: number;
}

/** Response of `GET /analytics/groups/:id`. */
export interface GroupAnalyticsDetail {
  group: { groupId: string; name: string; code: string; departmentName: string };
  summary: {
    traineeCount: number;
    completionPercentage: number;
    averageScore: number | null;
    activeUsers7d: number;
    totalTimeSpentSeconds: number;
  };
  /** Sorted performanceScore descending. */
  members: GroupMemberAnalyticsRow[];
  /** Last ANALYTICS_TIMELINE_DAYS days, summed across members, zero-filled. */
  activityTimeline: DailyActivityPoint[];
}

export interface UserCourseAnalyticsRow {
  courseId: string;
  title: string;
  isMandatory: boolean;
  completionPercentage: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  timeSpentSeconds: number;
}

export interface UserRecentAttemptRow {
  attemptId: string;
  assessmentId: string;
  assessmentTitle: string;
  status: AssessmentAttemptStatus;
  percentage: number | null;
  passed: boolean | null;
  submittedAt: Date | null;
}

/** Response of `GET /analytics/users/:id` and `GET /analytics/me`. */
export interface UserAnalytics {
  user: {
    userId: string;
    name: string;
    email: string;
    departmentName: string | null;
    groupNames: string[];
    lastLogin: Date | null;
  };
  /** The user's UserPerformanceSnapshot, verbatim (recomputed first if stale). */
  performance: {
    coursesAssigned: number;
    coursesCompleted: number;
    lessonsCompleted: number;
    totalAssignedLessons: number;
    completionPercentage: number;
    timeSpentSeconds: number;
    assessmentsAssigned: number;
    assessmentsTaken: number;
    assessmentsPassed: number;
    averageScore: number | null;
    activityEvents7d: number;
    performanceScore: number;
    lastActivityAt: Date | null;
    computedAt: Date;
  };
  /** Consecutive active days ending today or yesterday (see computeStreakDays). */
  streakDays: number;
  courses: UserCourseAnalyticsRow[];
  /** Latest 10 assessment attempts, newest first. */
  recentAttempts: UserRecentAttemptRow[];
  /** Last ANALYTICS_ACTIVITY_WINDOW_DAYS days, zero-filled. */
  dailyActivity: DailyActivityPoint[];
  aiUsage: { conversations: number; messages: number };
  qnaActivity: {
    questionsAsked: number;
    /** Answers by OTHER users on this user's questions. */
    answersReceived: number;
    /** Verified answers on this user's questions (any author). */
    verifiedAnswers: number;
  };
}

export interface LeaderboardFilters {
  groupId?: string;
  departmentId?: string;
  courseId?: string;
  limit?: number;
}

export interface LeaderboardEntry {
  /** 1-based position after sorting performanceScore desc, completionPercentage desc, name asc. */
  rank: number;
  userId: string;
  name: string;
  groupNames: string[];
  completionPercentage: number;
  averageScore: number | null;
  activityEvents7d: number;
  performanceScore: number;
}

/** One step of CourseAnalyticsSnapshot.lessonFunnel (stored as JSON, ordered by module/lesson order). */
export interface LessonFunnelStep {
  lessonId: string;
  title: string;
  moduleTitle: string;
  /** 1-based position across the whole funnel. */
  order: number;
  completedCount: number;
  completionRate: number;
  dropOffRate: number;
}

/** Response of `GET /analytics/courses/:id` — CourseAnalyticsSnapshot flattened camelCase. */
export interface CourseAnalytics {
  course: { courseId: string; title: string; status: CourseStatus };
  assignedTrainees: number;
  startedCount: number;
  completedCount: number;
  completionRate: number;
  averageTimeSpentSeconds: number;
  /** Population proxy — see CourseAnalyticsSnapshot's schema doc comment. */
  averageScore: number | null;
  lessonFunnel: LessonFunnelStep[];
  computedAt: Date;
}

/** One entry of AssessmentAnalyticsSnapshot.questionStats (stored as JSON). */
export interface AssessmentQuestionStat {
  assessmentQuestionId: string;
  title: string;
  type: QuestionType;
  /** 'UNKNOWN' when the bank question was deleted (AssessmentQuestion.questionId SetNull). */
  category: QuestionCategory | 'UNKNOWN';
  difficulty: QuestionDifficulty | null;
  answeredCount: number;
  correctCount: number;
  /** percentage(correctCount, answers with isCorrect != null). */
  correctRate: number;
}

/** One entry of AssessmentAnalyticsSnapshot.weakTopics (stored as JSON, weakest first). */
export interface AssessmentWeakTopic {
  category: QuestionCategory | 'UNKNOWN';
  answeredCount: number;
  correctCount: number;
  correctRate: number;
}

/** Response of `GET /analytics/assessments/:id` — AssessmentAnalyticsSnapshot flattened camelCase. */
export interface AssessmentAnalytics {
  assessment: { assessmentId: string; title: string; status: AssessmentStatus };
  assignedTrainees: number;
  attemptedCount: number;
  submittedCount: number;
  gradedCount: number;
  participationRate: number;
  averageScore: number | null;
  passRate: number | null;
  questionStats: AssessmentQuestionStat[];
  weakTopics: AssessmentWeakTopic[];
  computedAt: Date;
}

/** Result of `POST /analytics/refresh` — how many snapshots of each kind were recomputed. */
export interface RefreshResult {
  users: number;
  courses: number;
  assessments: number;
}

export interface LiveAnalyticsFilters {
  rangeDays: 7 | 30 | 90;
  departmentId?: string;
  groupId?: string;
  courseId?: string;
  assessmentId?: string;
}

export interface LiveAnalyticsOverview {
  generatedAt: Date;
  rangeDays: number;
  summary: {
    totalTrainees: number;
    activeTrainees: number;
    learningHours: number;
    averageCompletion: number;
    averageScore: number | null;
    passRate: number | null;
    mandatoryCompletion: number;
  };
  activityTimeline: DailyActivityPoint[];
  completionDistribution: { status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'; count: number }[];
  groups: GroupAnalyticsRow[];
  courses: Array<{
    courseId: string;
    title: string;
    isMandatory: boolean;
    assignedTrainees: number;
    startedCount: number;
    completedCount: number;
    completionRate: number;
    averageScore: number | null;
  }>;
  assessments: Array<{
    assessmentId: string;
    title: string;
    assignedTrainees: number;
    participationRate: number;
    averageScore: number | null;
    passRate: number | null;
  }>;
  mandatoryCompliance: Array<{
    courseId: string;
    title: string;
    assigned: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    completionRate: number;
  }>;
  leaderboard: LeaderboardEntry[];
  atRiskTrainees: Array<{
    userId: string;
    name: string;
    completionPercentage: number;
    averageScore: number | null;
    lastActivityAt: Date | null;
  }>;
  integrityEvents: Array<{ type: string; count: number }>;
}
