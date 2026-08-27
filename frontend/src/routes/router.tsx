import { Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';

import { LoadingScreen } from '@/components/shared';
import { ROLES } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';
import { AdminLayout } from '@/layouts/admin-layout';
import { AuthLayout } from '@/layouts/auth-layout';
import { PublicLayout } from '@/layouts/public-layout';
import { TraineeLayout } from '@/layouts/trainee-layout';
import { TrainerLayout } from '@/layouts/trainer-layout';
import {
  AdminDashboardPage,
  AdminSettingsPage,
  AiChatPage,
  AiHistoryPage,
  AskQuestionPage,
  AssessmentAnalyticsPage,
  AssessmentEditorPage,
  AssessmentListPage,
  AuditLogPage,
  AssessmentPlayerPage,
  AssessmentResultPage,
  AssessmentResultsPage,
  AttemptGradingPage,
  CalendarPage,
  ChangePasswordPage,
  CourseAnalyticsPage,
  CourseEditorPage,
  CourseListPage,
  DepartmentsListPage,
  ForbiddenPage,
  ForgotPasswordPage,
  GroupAnalyticsPage,
  GroupDetailsPage,
  GroupsListPage,
  HomePage,
  ImpactMetricsPage,
  LessonViewerPage,
  LoginPage,
  LiveAnalysisPage,
  MyAssessmentsPage,
  MyCalendarPage,
  MyClassroomPage,
  MyPerformancePage,
  MyProgressPage,
  NotFoundPage,
  NotificationsPage,
  ProfilePage,
  QnaSearchPage,
  QuestionBankPage,
  QuestionDetailPage,
  QuestionFeedPage,
  ReportsPage,
  ResetPasswordPage,
  TimingObservationsPage,
  TraineeCourseDetailPage,
  TraineeDashboardPage,
  TrainerDashboardPage,
  UserAnalyticsPage,
  UserSettingsPage,
  UsersListPage,
} from '@/routes/lazy-pages';
import { GuestOnlyRoute, RouteGuard } from '@/routes/route-guard';

/**
 * Every route-level PAGE component is code-split via `React.lazy` (declared in `./lazy-pages`,
 * see that file's comment for why they live there) so the main bundle only ships the shell
 * (layouts + router + guards) up front — each page's module graph loads on first visit to that
 * route. Shared layouts (`AdminLayout`, `AuthLayout`, etc.) stay eager above since they wrap
 * every page in their branch and lazy-loading them would just add a waterfall before the page
 * itself could even start loading.
 *
 * Suspense boundaries live inside each shell layout (see `dashboard-layout.tsx`,
 * `public-layout.tsx`, `auth-layout.tsx`), wrapping only their `<Outlet />` — not the whole route
 * tree. That way the sidebar/header/chrome never unmounts on navigation; only the content area
 * shows the fallback, and only on a route whose chunk hasn't been fetched yet (react-router keeps
 * the fetched module cached, so revisiting an already-loaded route never re-suspends). The
 * top-level catch-all ('*') isn't nested under any layout, so it gets its own local boundary.
 */

/**
 * Route tree with real auth/role guards (ARCHITECTURE.md §9-10, Prompt 3). `RouteGuard` is a
 * layout route (renders <Outlet/>) so it can wrap an entire role branch in one place; each
 * role's dashboard still gets its own nested children as those modules are built out.
 */
export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: ROUTES.HOME, element: <HomePage /> },
      { path: ROUTES.FORBIDDEN, element: <ForbiddenPage /> },
      { path: ROUTES.NOT_FOUND, element: <NotFoundPage /> },
    ],
  },
  {
    element: <GuestOnlyRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: ROUTES.LOGIN, element: <LoginPage /> },
          { path: ROUTES.FORGOT_PASSWORD, element: <ForgotPasswordPage /> },
          { path: ROUTES.RESET_PASSWORD, element: <ResetPasswordPage /> },
        ],
      },
    ],
  },
  {
    element: <RouteGuard allowedRoles={[ROLES.SUPER_ADMIN]} />,
    children: [
      {
        path: ROUTES.ADMIN.ROOT,
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: 'trainers', element: <UsersListPage manageRole="TRAINER" /> },
          { path: 'departments', element: <DepartmentsListPage /> },
          { path: 'groups', element: <GroupsListPage /> },
          { path: 'groups/:id', element: <GroupDetailsPage /> },
          { path: 'classroom', element: <CourseListPage /> },
          { path: 'classroom/:courseId', element: <CourseEditorPage /> },
          { path: 'classroom/:courseId/analytics', element: <CourseAnalyticsPage /> },
          { path: 'classroom/:courseId/lessons/:lessonId', element: <LessonViewerPage /> },
          { path: 'assessments', element: <AssessmentListPage /> },
          { path: 'assessments/:id', element: <AssessmentEditorPage /> },
          { path: 'assessments/:id/results', element: <AssessmentResultsPage /> },
          { path: 'assessments/:id/analytics', element: <AssessmentAnalyticsPage /> },
          { path: 'assessments/:id/results/:attemptId', element: <AttemptGradingPage /> },
          { path: 'questions', element: <QuestionBankPage /> },
          { path: 'calendar', element: <CalendarPage /> },
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'groups/:id/analytics', element: <GroupAnalyticsPage /> },
          { path: 'users/:id/analytics', element: <UserAnalyticsPage /> },
          { path: 'audit-log', element: <AuditLogPage /> },
          { path: 'timing-observations', element: <TimingObservationsPage /> },
          { path: 'impact-metrics', element: <ImpactMetricsPage /> },
          { path: 'analysis', element: <LiveAnalysisPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'change-password', element: <ChangePasswordPage /> },
          { path: 'settings', element: <AdminSettingsPage /> },
        ],
      },
    ],
  },
  {
    element: <RouteGuard allowedRoles={[ROLES.TRAINER]} />,
    children: [
      {
        path: ROUTES.TRAINER.ROOT,
        element: <TrainerLayout />,
        children: [
          { index: true, element: <TrainerDashboardPage /> },
          { path: 'trainees', element: <UsersListPage manageRole="TRAINEE" /> },
          { path: 'departments', element: <DepartmentsListPage /> },
          { path: 'groups', element: <GroupsListPage /> },
          { path: 'groups/:id', element: <GroupDetailsPage /> },
          { path: 'classroom', element: <CourseListPage /> },
          { path: 'classroom/:courseId', element: <CourseEditorPage /> },
          { path: 'classroom/:courseId/analytics', element: <CourseAnalyticsPage /> },
          { path: 'classroom/:courseId/lessons/:lessonId', element: <LessonViewerPage /> },
          { path: 'assessments', element: <AssessmentListPage /> },
          { path: 'assessments/:id', element: <AssessmentEditorPage /> },
          { path: 'assessments/:id/results', element: <AssessmentResultsPage /> },
          { path: 'assessments/:id/analytics', element: <AssessmentAnalyticsPage /> },
          { path: 'assessments/:id/results/:attemptId', element: <AttemptGradingPage /> },
          { path: 'questions', element: <QuestionBankPage /> },
          { path: 'calendar', element: <CalendarPage /> },
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'groups/:id/analytics', element: <GroupAnalyticsPage /> },
          { path: 'users/:id/analytics', element: <UserAnalyticsPage /> },
          { path: 'analysis', element: <LiveAnalysisPage /> },
          { path: 'reports', element: <ReportsPage /> },
          { path: 'timing-observations', element: <TimingObservationsPage /> },
          { path: 'impact-metrics', element: <ImpactMetricsPage /> },
          // Static paths ('ask', 'search') registered before the dynamic ':id' so the router
          // doesn't parse either as a question id.
          { path: 'qna', element: <QuestionFeedPage /> },
          { path: 'qna/ask', element: <AskQuestionPage /> },
          { path: 'qna/search', element: <QnaSearchPage /> },
          { path: 'qna/:id', element: <QuestionDetailPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'change-password', element: <ChangePasswordPage /> },
          { path: 'settings', element: <UserSettingsPage /> },
        ],
      },
    ],
  },
  {
    element: <RouteGuard allowedRoles={[ROLES.TRAINEE]} />,
    children: [
      {
        path: ROUTES.TRAINEE.ROOT,
        element: <TraineeLayout />,
        children: [
          { index: true, element: <TraineeDashboardPage /> },
          { path: 'classroom', element: <MyClassroomPage /> },
          { path: 'classroom/:courseId', element: <TraineeCourseDetailPage /> },
          { path: 'classroom/:courseId/lessons/:lessonId', element: <LessonViewerPage /> },
          { path: 'assessments', element: <MyAssessmentsPage /> },
          { path: 'assessments/:id/take', element: <AssessmentPlayerPage /> },
          { path: 'assessments/:id/result', element: <AssessmentResultPage /> },
          { path: 'calendar', element: <MyCalendarPage /> },
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'my-progress', element: <MyProgressPage /> },
          { path: 'my-performance', element: <MyPerformancePage /> },
          // Static paths ('ask', 'search') registered before the dynamic ':id' so the router
          // doesn't parse either as a question id.
          { path: 'qna', element: <QuestionFeedPage /> },
          { path: 'qna/ask', element: <AskQuestionPage /> },
          { path: 'qna/search', element: <QnaSearchPage /> },
          { path: 'qna/:id', element: <QuestionDetailPage /> },
          // Static 'history' before the query-param-driven chat page itself (which has no
          // further path segments, so no ordering conflict there — listed for clarity only).
          { path: 'ai-tutor', element: <AiChatPage /> },
          { path: 'ai-tutor/history', element: <AiHistoryPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'change-password', element: <ChangePasswordPage /> },
          { path: 'settings', element: <UserSettingsPage /> },
        ],
      },
    ],
  },
  // Not nested under any layout's <Outlet/>, so it needs its own Suspense boundary.
  {
    path: '*',
    element: (
      <Suspense fallback={<LoadingScreen />}>
        <NotFoundPage />
      </Suspense>
    ),
  },
]);
