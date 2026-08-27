import type { GroupAnalyticsRow, LeaderboardEntry } from '@/modules/analytics';

// Internal domain types + response shapes for the dashboard module. These double as the
// module's published types (re-exported from index.ts) — the frontend contract
// (frontend/src/features/analytics/types/index.ts) depends on them exactly as shaped here.

export type DashboardCourseStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export type AnalyticsInsightKind = 'WEAK_TOPIC' | 'SUGGESTED_LESSON' | 'SUGGESTED_ASSESSMENT' | 'GENERAL';

export interface AnalyticsInsight {
  kind: AnalyticsInsightKind;
  text: string;
}

/**
 * AI-generated (or heuristic-fallback) recommendations block, shared by both dashboards and
 * backed by the `AnalyticsInsight` cache table — see dashboard-insights.service.ts.
 */
export interface AnalyticsInsights {
  source: 'AI' | 'HEURISTIC';
  generatedAt: Date;
  insights: AnalyticsInsight[];
}

export interface QnaActivitySummary {
  questionsAsked: number;
  /** Answers by OTHER users on this user's questions — mirrors UserAnalytics.qnaActivity. */
  answersReceived: number;
  verifiedAnswers: number;
}

/* -------------------------------------------------------------------------- */
/* Trainee dashboard — GET /dashboard/trainee                                 */
/* -------------------------------------------------------------------------- */

export interface TraineeWelcome {
  name: string;
  departmentName: string | null;
  groupNames: string[];
  streakDays: number;
  overallCompletionPercentage: number;
}

export interface ContinueLearningDashboardItem {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  status: DashboardCourseStatus;
  timeSpentSeconds: number;
  lastViewedAt: Date | null;
}

export interface TraineeCourseProgress {
  courseId: string;
  title: string;
  isMandatory: boolean;
  completionPercentage: number;
  status: DashboardCourseStatus;
}

export interface UpcomingAssessment {
  assessmentId: string;
  title: string;
  dueDate: Date | null;
}

export interface RecentAssessmentResult {
  assessmentId: string;
  title: string;
  percentage: number | null;
  passed: boolean | null;
  submittedAt: Date | null;
}

export interface TraineeAssessmentsSummary {
  upcoming: UpcomingAssessment[];
  averageScore: number | null;
  taken: number;
  passed: number;
  recentResults: RecentAssessmentResult[];
}

export interface UpcomingDashboardEvent {
  id: string;
  title: string;
  /** CalendarEventType, widened to `string` — the dashboard doesn't need the enum's literals. */
  type: string;
  startAt: Date;
}

export interface TraineeDashboard {
  welcome: TraineeWelcome;
  continueLearning: ContinueLearningDashboardItem[];
  myCourses: TraineeCourseProgress[];
  assessments: TraineeAssessmentsSummary;
  upcomingEvents: UpcomingDashboardEvent[];
  recommendations: AnalyticsInsights;
  qnaActivity: QnaActivitySummary;
}

/* -------------------------------------------------------------------------- */
/* Trainer dashboard — GET /dashboard/trainer                                 */
/* -------------------------------------------------------------------------- */

export interface TrainerOverview {
  totalTrainees: number;
  totalGroups: number;
  totalCourses: number;
  activeAssessments: number;
  averageCompletion: number;
  averageScore: number | null;
}

/** `GET /analytics/leaderboard`'s payload shape, embedded verbatim in `TrainerDashboard`. */
export interface LeaderboardData {
  items: LeaderboardEntry[];
}

export interface TrainerDashboard {
  overview: TrainerOverview;
  /** `analyticsService.getGroupsAnalytics` rows, re-exported verbatim — see dashboard.service.ts. */
  groups: GroupAnalyticsRow[];
  leaderboard: LeaderboardData;
  insights: AnalyticsInsights;
  pendingGradingCount: number;
}
