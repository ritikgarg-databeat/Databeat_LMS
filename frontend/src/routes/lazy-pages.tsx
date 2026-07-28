import { lazy } from 'react';

/**
 * Every route-level PAGE component, code-split via `React.lazy`, so the main bundle only ships
 * the shell (layouts + router + guards) up front — each page's module graph loads on first visit
 * to that route. Kept in their own module (rather than declared inline in `router.tsx`) purely so
 * this file only exports components — `router.tsx` also exports the non-component `router`
 * value, and mixing component + non-component exports in one file defeats Vite Fast Refresh
 * (`react-refresh/only-export-components`).
 *
 * Components reused across multiple roles (e.g. `CourseListPage` for both /admin/classroom and
 * /trainer/classroom) are wrapped in `lazy()` ONCE here and the same lazy component is imported
 * by every route that needs it, so there's a single chunk + a single lazy-component identity per
 * page, not one per route entry.
 */

// --- ai ---
export const AiChatPage = lazy(() =>
  import('@/features/ai/pages/ai-chat-page').then((m) => ({ default: m.AiChatPage })),
);
export const AiHistoryPage = lazy(() =>
  import('@/features/ai/pages/ai-history-page').then((m) => ({ default: m.AiHistoryPage })),
);

// --- analytics ---
export const AssessmentAnalyticsPage = lazy(() =>
  import('@/features/analytics/pages/assessment-analytics-page').then((m) => ({
    default: m.AssessmentAnalyticsPage,
  })),
);
export const CourseAnalyticsPage = lazy(() =>
  import('@/features/analytics/pages/course-analytics-page').then((m) => ({ default: m.CourseAnalyticsPage })),
);
export const GroupAnalyticsPage = lazy(() =>
  import('@/features/analytics/pages/group-analytics-page').then((m) => ({ default: m.GroupAnalyticsPage })),
);
export const MyPerformancePage = lazy(() =>
  import('@/features/analytics/pages/my-performance-page').then((m) => ({ default: m.MyPerformancePage })),
);
export const MyProgressPage = lazy(() =>
  import('@/features/analytics/pages/my-progress-page').then((m) => ({ default: m.MyProgressPage })),
);
export const UserAnalyticsPage = lazy(() =>
  import('@/features/analytics/pages/user-analytics-page').then((m) => ({ default: m.UserAnalyticsPage })),
);

// --- assessment ---
export const AssessmentEditorPage = lazy(() =>
  import('@/features/assessment/pages/assessment-editor-page').then((m) => ({ default: m.AssessmentEditorPage })),
);
export const AssessmentListPage = lazy(() =>
  import('@/features/assessment/pages/assessment-list-page').then((m) => ({ default: m.AssessmentListPage })),
);
export const AssessmentPlayerPage = lazy(() =>
  import('@/features/assessment/pages/assessment-player-page').then((m) => ({ default: m.AssessmentPlayerPage })),
);
export const AssessmentResultPage = lazy(() =>
  import('@/features/assessment/pages/assessment-result-page').then((m) => ({ default: m.AssessmentResultPage })),
);
export const AssessmentResultsPage = lazy(() =>
  import('@/features/assessment/pages/assessment-results-page').then((m) => ({ default: m.AssessmentResultsPage })),
);
export const AttemptGradingPage = lazy(() =>
  import('@/features/assessment/pages/attempt-grading-page').then((m) => ({ default: m.AttemptGradingPage })),
);
export const MyAssessmentsPage = lazy(() =>
  import('@/features/assessment/pages/my-assessments-page').then((m) => ({ default: m.MyAssessmentsPage })),
);
export const QuestionBankPage = lazy(() =>
  import('@/features/assessment/pages/question-bank-page').then((m) => ({ default: m.QuestionBankPage })),
);

// --- audit-log ---
export const AuditLogPage = lazy(() =>
  import('@/features/audit-log/pages/audit-log-page').then((m) => ({ default: m.AuditLogPage })),
);

// --- timing-observations ---
export const TimingObservationsPage = lazy(() =>
  import('@/features/timing-observations/pages/timing-observations-page').then((m) => ({
    default: m.TimingObservationsPage,
  })),
);

// --- impact-metrics ---
export const ImpactMetricsPage = lazy(() =>
  import('@/features/impact-metrics/pages/impact-metrics-page').then((m) => ({ default: m.ImpactMetricsPage })),
);

// --- auth ---
export const ChangePasswordPage = lazy(() =>
  import('@/features/auth/pages/change-password-page').then((m) => ({ default: m.ChangePasswordPage })),
);
export const ForgotPasswordPage = lazy(() =>
  import('@/features/auth/pages/forgot-password-page').then((m) => ({ default: m.ForgotPasswordPage })),
);
export const LoginPage = lazy(() =>
  import('@/features/auth/pages/login-page').then((m) => ({ default: m.LoginPage })),
);

// --- calendar ---
export const CalendarPage = lazy(() =>
  import('@/features/calendar/pages/calendar-page').then((m) => ({ default: m.CalendarPage })),
);
export const MyCalendarPage = lazy(() =>
  import('@/features/calendar/pages/my-calendar-page').then((m) => ({ default: m.MyCalendarPage })),
);

// --- classroom ---
export const CourseEditorPage = lazy(() =>
  import('@/features/classroom/pages/course-editor-page').then((m) => ({ default: m.CourseEditorPage })),
);
export const CourseListPage = lazy(() =>
  import('@/features/classroom/pages/course-list-page').then((m) => ({ default: m.CourseListPage })),
);
export const LessonViewerPage = lazy(() =>
  import('@/features/classroom/pages/lesson-viewer-page').then((m) => ({ default: m.LessonViewerPage })),
);
export const MyClassroomPage = lazy(() =>
  import('@/features/classroom/pages/my-classroom-page').then((m) => ({ default: m.MyClassroomPage })),
);
export const TraineeCourseDetailPage = lazy(() =>
  import('@/features/classroom/pages/trainee-course-detail-page').then((m) => ({
    default: m.TraineeCourseDetailPage,
  })),
);

// --- dashboard ---
export const AdminDashboardPage = lazy(() =>
  import('@/features/dashboard/pages/admin-dashboard-page').then((m) => ({ default: m.AdminDashboardPage })),
);
export const TraineeDashboardPage = lazy(() =>
  import('@/features/dashboard/pages/trainee-dashboard-page').then((m) => ({ default: m.TraineeDashboardPage })),
);
export const TrainerDashboardPage = lazy(() =>
  import('@/features/dashboard/pages/trainer-dashboard-page').then((m) => ({ default: m.TrainerDashboardPage })),
);

// --- departments ---
export const DepartmentsListPage = lazy(() =>
  import('@/features/departments/pages/departments-list-page').then((m) => ({ default: m.DepartmentsListPage })),
);

// --- groups ---
export const GroupDetailsPage = lazy(() =>
  import('@/features/groups/pages/group-details-page').then((m) => ({ default: m.GroupDetailsPage })),
);
export const GroupsListPage = lazy(() =>
  import('@/features/groups/pages/groups-list-page').then((m) => ({ default: m.GroupsListPage })),
);

// --- notifications ---
export const NotificationsPage = lazy(() =>
  import('@/features/notifications/pages/notifications-page').then((m) => ({ default: m.NotificationsPage })),
);

// --- profile ---
export const ProfilePage = lazy(() =>
  import('@/features/profile/pages/profile-page').then((m) => ({ default: m.ProfilePage })),
);

// --- qna ---
export const AskQuestionPage = lazy(() =>
  import('@/features/qna/pages/ask-question-page').then((m) => ({ default: m.AskQuestionPage })),
);
export const QuestionDetailPage = lazy(() =>
  import('@/features/qna/pages/question-detail-page').then((m) => ({ default: m.QuestionDetailPage })),
);
export const QuestionFeedPage = lazy(() =>
  import('@/features/qna/pages/question-feed-page').then((m) => ({ default: m.QuestionFeedPage })),
);
export const QnaSearchPage = lazy(() =>
  import('@/features/qna/pages/search-page').then((m) => ({ default: m.SearchPage })),
);

// --- reports ---
export const ReportsPage = lazy(() =>
  import('@/features/reports/pages/reports-page').then((m) => ({ default: m.ReportsPage })),
);

// --- settings ---
export const AdminSettingsPage = lazy(() =>
  import('@/features/settings/pages/admin-settings-page').then((m) => ({ default: m.AdminSettingsPage })),
);
export const UserSettingsPage = lazy(() =>
  import('@/features/settings/pages/user-settings-page').then((m) => ({ default: m.UserSettingsPage })),
);

// --- users ---
export const UsersListPage = lazy(() =>
  import('@/features/users/pages/users-list-page').then((m) => ({ default: m.UsersListPage })),
);

// --- top-level pages ---
export const ForbiddenPage = lazy(() => import('@/pages/forbidden-page').then((m) => ({ default: m.ForbiddenPage })));
export const HomePage = lazy(() => import('@/pages/home-page').then((m) => ({ default: m.HomePage })));
export const NotFoundPage = lazy(() => import('@/pages/not-found-page').then((m) => ({ default: m.NotFoundPage })));
