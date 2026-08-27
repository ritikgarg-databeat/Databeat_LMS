// Request DTOs (API-facing shapes) for the analytics module. Response shapes live in
// analytics.types.ts (they double as the module's published types). Query DTOs are typed as
// the unparsed strings Express actually hands the controller — mirrors
// ListContinueLearningQueryDto/ListQnaQuestionsQueryDto's convention.

/** Raw query params for `GET /analytics/groups`. */
export interface GroupsAnalyticsQueryDto {
  departmentId?: string;
}

/** Raw query params for `GET /analytics/leaderboard`. */
export interface LeaderboardQueryDto {
  groupId?: string;
  departmentId?: string;
  courseId?: string;
  limit?: string;
}

export interface OverviewQueryDto {
  rangeDays?: string;
  departmentId?: string;
  groupId?: string;
  courseId?: string;
  assessmentId?: string;
}
