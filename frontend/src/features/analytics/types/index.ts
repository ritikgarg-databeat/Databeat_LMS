// TypeScript types for the analytics feature (dashboards + drill-down analytics).
//
// Mirrors backend/src/modules/{dashboard,analytics} response shapes exactly. Every endpoint
// returns the standard `{success, message, data}` envelope (see @/types/api); the services layer
// unwraps it, so these types describe the `data` payloads only.

export type CourseProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export type AnalyticsInsightKind = 'WEAK_TOPIC' | 'SUGGESTED_LESSON' | 'SUGGESTED_ASSESSMENT' | 'GENERAL';

export interface AnalyticsInsight {
  kind: AnalyticsInsightKind;
  text: string;
}

/** AI-generated (or heuristic-fallback) recommendations block, shared by both dashboards. */
export interface AnalyticsInsights {
  source: 'AI' | 'HEURISTIC';
  generatedAt: string;
  insights: AnalyticsInsight[];
}

/**
 * One day of platform activity. Shared by `GroupAnalyticsDetail.activityTimeline` and
 * `UserAnalytics.dailyActivity`, and the input shape for the `ActivityHeatmap` component.
 */
export interface DailyActivityPoint {
  date: string;
  logins: number;
  lessonsCompleted: number;
  assessmentsSubmitted: number;
  aiMessages: number;
  qnaPosts: number;
}

export interface QnaActivitySummary {
  questionsAsked: number;
  answersReceived: number;
  verifiedAnswers: number;
}

/* -------------------------------------------------------------------------- */
/* Trainee dashboard — GET /dashboard/trainee                                  */
/* -------------------------------------------------------------------------- */

export interface TraineeWelcome {
  name: string;
  departmentName: string | null;
  groupNames: string[];
  streakDays: number;
  overallCompletionPercentage: number;
}

export interface ContinueLearningItem {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  status: CourseProgressStatus;
  timeSpentSeconds: number;
  lastViewedAt: string | null;
}

export interface TraineeCourseProgress {
  courseId: string;
  title: string;
  completionPercentage: number;
  status: CourseProgressStatus;
}

export interface UpcomingAssessment {
  assessmentId: string;
  title: string;
  dueDate: string | null;
}

export interface RecentAssessmentResult {
  assessmentId: string;
  title: string;
  percentage: number | null;
  passed: boolean | null;
  submittedAt: string | null;
}

export interface TraineeAssessmentsSummary {
  upcoming: UpcomingAssessment[];
  averageScore: number | null;
  taken: number;
  passed: number;
  recentResults: RecentAssessmentResult[];
}

export interface UpcomingEvent {
  id: string;
  title: string;
  type: string;
  startAt: string;
}

export interface TraineeDashboard {
  welcome: TraineeWelcome;
  continueLearning: ContinueLearningItem[];
  myCourses: TraineeCourseProgress[];
  assessments: TraineeAssessmentsSummary;
  upcomingEvents: UpcomingEvent[];
  recommendations: AnalyticsInsights;
  qnaActivity: QnaActivitySummary;
}

/* -------------------------------------------------------------------------- */
/* Trainer dashboard — GET /dashboard/trainer                                  */
/* -------------------------------------------------------------------------- */

export interface TrainerOverview {
  totalTrainees: number;
  totalGroups: number;
  totalCourses: number;
  activeAssessments: number;
  averageCompletion: number;
  averageScore: number | null;
}

/** One group's rollup row — shared by the trainer dashboard and `GET /analytics/groups`. */
export interface GroupAnalyticsRow {
  groupId: string;
  name: string;
  code: string;
  status: string;
  departmentName: string | null;
  traineeCount: number;
  completionPercentage: number;
  averageScore: number | null;
  activeUsers7d: number;
  lastActivityAt: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  groupNames: string[];
  completionPercentage: number;
  averageScore: number | null;
  activityEvents7d: number;
  performanceScore: number;
}

/** `GET /analytics/leaderboard` payload — also embedded in `TrainerDashboard.leaderboard`. */
export interface LeaderboardData {
  items: LeaderboardEntry[];
}

export interface TrainerDashboard {
  overview: TrainerOverview;
  groups: GroupAnalyticsRow[];
  leaderboard: LeaderboardData;
  insights: AnalyticsInsights;
  pendingGradingCount: number;
}

/* -------------------------------------------------------------------------- */
/* Group analytics — GET /analytics/groups, GET /analytics/groups/:id          */
/* -------------------------------------------------------------------------- */

/** `GET /analytics/groups` payload. */
export interface GroupAnalyticsList {
  items: GroupAnalyticsRow[];
}

export interface GroupsAnalyticsParams {
  departmentId?: string;
}

export interface GroupAnalyticsSummary {
  traineeCount: number;
  completionPercentage: number;
  averageScore: number | null;
  activeUsers7d: number;
  totalTimeSpentSeconds: number;
}

export interface GroupMemberAnalytics {
  userId: string;
  name: string;
  email: string;
  completionPercentage: number;
  averageScore: number | null;
  lessonsCompleted: number;
  assessmentsTaken: number;
  lastActivityAt: string | null;
  performanceScore: number;
}

export interface GroupAnalyticsDetail {
  group: {
    groupId: string;
    name: string;
    code: string;
    departmentName: string | null;
  };
  summary: GroupAnalyticsSummary;
  members: GroupMemberAnalytics[];
  activityTimeline: DailyActivityPoint[];
}

/* -------------------------------------------------------------------------- */
/* User analytics — GET /analytics/users/:id and GET /analytics/me             */
/* -------------------------------------------------------------------------- */

export interface UserPerformance {
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
  lastActivityAt: string | null;
  computedAt: string;
}

export interface UserCourseProgress {
  courseId: string;
  title: string;
  completionPercentage: number;
  status: CourseProgressStatus;
  timeSpentSeconds: number;
}

export interface RecentAttempt {
  attemptId: string;
  assessmentId: string;
  assessmentTitle: string;
  status: string;
  percentage: number | null;
  passed: boolean | null;
  submittedAt: string | null;
}

export interface UserAnalytics {
  user: {
    userId: string;
    name: string;
    email: string;
    departmentName: string | null;
    groupNames: string[];
    lastLogin: string | null;
  };
  performance: UserPerformance;
  streakDays: number;
  courses: UserCourseProgress[];
  recentAttempts: RecentAttempt[];
  dailyActivity: DailyActivityPoint[];
  aiUsage: {
    conversations: number;
    messages: number;
  };
  qnaActivity: QnaActivitySummary;
}

/* -------------------------------------------------------------------------- */
/* Leaderboard params — GET /analytics/leaderboard                             */
/* -------------------------------------------------------------------------- */

export interface LeaderboardParams {
  groupId?: string;
  departmentId?: string;
  courseId?: string;
  limit?: number;
}

/* -------------------------------------------------------------------------- */
/* Course analytics — GET /analytics/courses/:id                               */
/* -------------------------------------------------------------------------- */

export interface LessonFunnelStep {
  lessonId: string;
  title: string;
  moduleTitle: string;
  order: number;
  completedCount: number;
  completionRate: number;
  dropOffRate: number;
}

export interface CourseAnalytics {
  course: {
    courseId: string;
    title: string;
    status: string;
  };
  assignedTrainees: number;
  startedCount: number;
  completedCount: number;
  completionRate: number;
  averageTimeSpentSeconds: number;
  averageScore: number | null;
  lessonFunnel: LessonFunnelStep[];
  computedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Assessment analytics — GET /analytics/assessments/:id                       */
/* -------------------------------------------------------------------------- */

export interface AssessmentQuestionStat {
  assessmentQuestionId: string;
  title: string;
  type: string;
  category: string;
  difficulty: string | null;
  answeredCount: number;
  correctCount: number;
  correctRate: number;
}

export interface WeakTopic {
  category: string;
  answeredCount: number;
  correctCount: number;
  correctRate: number;
}

export interface AssessmentAnalytics {
  assessment: {
    assessmentId: string;
    title: string;
    status: string;
    passingPercentage: number;
  };
  assignedTrainees: number;
  attemptedCount: number;
  submittedCount: number;
  gradedCount: number;
  participationRate: number;
  averageScore: number | null;
  passRate: number | null;
  questionStats: AssessmentQuestionStat[];
  weakTopics: WeakTopic[];
  computedAt: string;
}
