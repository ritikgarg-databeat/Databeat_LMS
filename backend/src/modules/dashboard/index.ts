export { default as dashboardRoutes } from './dashboard.routes';

export { DashboardService, dashboardService } from './dashboard.service';
export { DashboardInsightsService, dashboardInsightsService } from './dashboard-insights.service';
export type {
  AnalyticsInsight,
  AnalyticsInsightKind,
  AnalyticsInsights,
  ContinueLearningDashboardItem,
  DashboardCourseStatus,
  LeaderboardData,
  QnaActivitySummary,
  RecentAssessmentResult,
  TraineeAssessmentsSummary,
  TraineeCourseProgress,
  TraineeDashboard,
  TraineeWelcome,
  TrainerDashboard,
  TrainerOverview,
  UpcomingAssessment,
  UpcomingDashboardEvent,
} from './dashboard.types';
