export { default as analyticsRoutes } from './analytics.routes';

// Published contract: other modules (e.g. the AI-insights slice) import `aggregationService`
// to trigger snapshot recomputes, and reuse the types below — keep these names stable.
export { AggregationService, aggregationService } from './aggregation.service';
export { AnalyticsService, analyticsService } from './analytics.service';
export type {
  AssessmentAnalytics,
  AssessmentQuestionStat,
  AssessmentWeakTopic,
  CourseAnalytics,
  DailyActivityPoint,
  GroupAnalyticsDetail,
  GroupAnalyticsRow,
  GroupMemberAnalyticsRow,
  GroupsAnalyticsFilters,
  LeaderboardEntry,
  LeaderboardFilters,
  LessonFunnelStep,
  RefreshResult,
  UserAnalytics,
  UserCourseAnalyticsRow,
  UserRecentAttemptRow,
} from './analytics.types';
