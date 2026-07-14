/**
 * Fine-grained, namespaced permission strings ("module:action"), matching the RBAC design
 * in ARCHITECTURE.md §10. Roles are bundles of these — the frontend uses this list purely
 * for `hasPermission()` checks against whatever the (future) auth session reports; it does
 * not decide access on its own (the backend is the source of truth).
 */
export const PERMISSIONS = {
  USER_CREATE: 'user:create',
  USER_DISABLE: 'user:disable',
  USER_RESET_PASSWORD: 'user:reset-password',
  DEPARTMENT_CREATE: 'department:create',
  GROUP_CREATE: 'group:create',
  GROUP_ASSIGN: 'group:assign',
  COURSE_CREATE: 'course:create',
  COURSE_PUBLISH: 'course:publish',
  LESSON_UPLOAD: 'lesson:upload',
  ASSESSMENT_CREATE: 'assessment:create',
  ASSESSMENT_GRADE: 'assessment:grade',
  CALENDAR_MANAGE: 'calendar:manage',
  QNA_MODERATE: 'qna:moderate',
  ANALYTICS_VIEW_OWN: 'analytics:view:own',
  ANALYTICS_VIEW_GROUP: 'analytics:view:group',
  ANALYTICS_VIEW_DEPARTMENT: 'analytics:view:department',
  REPORTS_EXPORT: 'reports:export',
  SETTINGS_MANAGE: 'settings:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
