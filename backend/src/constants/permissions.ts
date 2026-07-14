import { ROLES, type Role } from '@/constants/roles';

/**
 * Fine-grained, namespaced permission strings ("module:action"), per the RBAC design in
 * ARCHITECTURE.md §10. `RolePermission` (once the schema exists) maps each Role to a set
 * of these — middleware checks this list, never the raw role name, so adding a role later
 * is a data change, not a code change.
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

/**
 * Static Role → Permission bundle, used by `requirePermission` middleware. "Future-ready"
 * per the phase spec: this hardcoded map is what a `RolePermission` DB table (ARCHITECTURE.md
 * §10) will replace once permissions need to be editable without a deploy — the middleware's
 * call sites (`requirePermission(PERMISSIONS.USER_CREATE)`) won't need to change either way.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [ROLES.TRAINER]: [
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_DISABLE,
    PERMISSIONS.USER_RESET_PASSWORD,
    PERMISSIONS.GROUP_CREATE,
    PERMISSIONS.GROUP_ASSIGN,
    PERMISSIONS.COURSE_CREATE,
    PERMISSIONS.COURSE_PUBLISH,
    PERMISSIONS.LESSON_UPLOAD,
    PERMISSIONS.ASSESSMENT_CREATE,
    PERMISSIONS.ASSESSMENT_GRADE,
    PERMISSIONS.CALENDAR_MANAGE,
    PERMISSIONS.QNA_MODERATE,
    PERMISSIONS.ANALYTICS_VIEW_GROUP,
    PERMISSIONS.REPORTS_EXPORT,
  ],
  [ROLES.TRAINEE]: [PERMISSIONS.ANALYTICS_VIEW_OWN],
};
