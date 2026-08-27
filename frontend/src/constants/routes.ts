import { ROLES, type Role } from '@/constants/roles';

/**
 * Central path registry. Import these instead of writing string literals in `<Link>`/`navigate()`
 * calls, so a path can be renamed in one place. Role-scoped areas are grouped as sub-objects.
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',

  // profile/change-password are nested under each role root below (e.g. /trainer/profile)
  // rather than listed as standalone absolute paths, since each role keeps its own sidebar.
  ADMIN: {
    ROOT: '/admin',
    TRAINERS: '/admin/trainers',
    DEPARTMENTS: '/admin/departments',
    GROUPS: '/admin/groups',
    CLASSROOM: '/admin/classroom',
    ASSESSMENTS: '/admin/assessments',
    QUESTIONS: '/admin/questions',
    CALENDAR: '/admin/calendar',
    AUDIT_LOG: '/admin/audit-log',
    TIMING_OBSERVATIONS: '/admin/timing-observations',
    IMPACT_METRICS: '/admin/impact-metrics',
    LIVE_ANALYSIS: '/admin/analysis',
    REPORTS: '/admin/reports',
    SETTINGS: '/admin/settings',
  },
  TRAINER: {
    ROOT: '/trainer',
    TRAINEES: '/trainer/trainees',
    DEPARTMENTS: '/trainer/departments',
    GROUPS: '/trainer/groups',
    CLASSROOM: '/trainer/classroom',
    ASSESSMENTS: '/trainer/assessments',
    QUESTIONS: '/trainer/questions',
    CALENDAR: '/trainer/calendar',
    QNA: '/trainer/qna',
    LIVE_ANALYSIS: '/trainer/analysis',
    REPORTS: '/trainer/reports',
    TIMING_OBSERVATIONS: '/trainer/timing-observations',
    IMPACT_METRICS: '/trainer/impact-metrics',
    SETTINGS: '/trainer/settings',
  },
  TRAINEE: {
    ROOT: '/trainee',
    CLASSROOM: '/trainee/classroom',
    ASSESSMENTS: '/trainee/assessments',
    CALENDAR: '/trainee/calendar',
    QNA: '/trainee/qna',
    AI_TUTOR: '/trainee/ai-tutor',
    MY_PROGRESS: '/trainee/my-progress',
    MY_PERFORMANCE: '/trainee/my-performance',
    SETTINGS: '/trainee/settings',
  },

  FORBIDDEN: '/403',
  NOT_FOUND: '/404',
} as const;

/** Where a user lands right after login — keyed by role so redirect logic stays in one place. */
export function getDashboardPath(role: Role): string {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return ROUTES.ADMIN.ROOT;
    case ROLES.TRAINER:
      return ROUTES.TRAINER.ROOT;
    case ROLES.TRAINEE:
      return ROUTES.TRAINEE.ROOT;
    default:
      return ROUTES.HOME;
  }
}

/**
 * Where a user with `mustChangePassword: true` is forced to first (Prompt 10 § Part 6) —
 * mirrors `getDashboardPath`, since `change-password` is nested per role rather than a
 * standalone absolute path (see the ROUTES comment above).
 */
export function getChangePasswordPath(role: Role): string {
  return `${getDashboardPath(role)}/change-password`;
}
