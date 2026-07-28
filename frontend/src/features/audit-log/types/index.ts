export type SortOrder = 'asc' | 'desc';

/** Kept as a local, hand-curated mirror of the backend's `AuditAction` Prisma enum — the same
 * "no shared-types codegen between the two TS projects" convention used for `Role`/question
 * categories elsewhere in this codebase. Update alongside `backend/src/prisma/schema.prisma`. */
export const AUDIT_ACTIONS = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'PASSWORD_CHANGED',
  'PASSWORD_RESET_BY_ADMIN',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DEACTIVATED',
  'USER_REACTIVATED',
  'USER_ROLE_CHANGED',
  'DEPARTMENT_CREATED',
  'DEPARTMENT_UPDATED',
  'DEPARTMENT_STATUS_CHANGED',
  'GROUP_CREATED',
  'GROUP_UPDATED',
  'GROUP_ARCHIVED',
  'GROUP_RESTORED',
  'GROUP_DELETED',
  'GROUP_MEMBER_ADDED',
  'GROUP_MEMBER_REMOVED',
  'GROUP_MEMBER_TRANSFERRED',
  'GROUP_BULK_IMPORT',
  'GROUP_TRAINER_ASSIGNED',
  'COURSE_CREATED',
  'COURSE_UPDATED',
  'COURSE_STATUS_CHANGED',
  'COURSE_DELETED',
  'COURSE_ASSIGNED_TO_GROUP',
  'COURSE_UNASSIGNED_FROM_GROUP',
  'MODULE_CREATED',
  'MODULE_UPDATED',
  'MODULE_DELETED',
  'MODULE_REORDERED',
  'LESSON_CREATED',
  'LESSON_UPDATED',
  'LESSON_DELETED',
  'LESSON_REORDERED',
  'RESOURCE_UPLOADED',
  'RESOURCE_DELETED',
  'QUESTION_CREATED',
  'QUESTION_UPDATED',
  'QUESTION_STATUS_CHANGED',
  'QUESTION_DELETED',
  'ASSESSMENT_CREATED',
  'ASSESSMENT_UPDATED',
  'ASSESSMENT_STATUS_CHANGED',
  'ASSESSMENT_DELETED',
  'ASSESSMENT_ASSIGNED_TO_GROUP',
  'ASSESSMENT_UNASSIGNED_FROM_GROUP',
  'ASSESSMENT_QUESTION_ADDED',
  'ASSESSMENT_QUESTION_REMOVED',
  'ASSESSMENT_QUESTIONS_REORDERED',
  'ASSESSMENT_ATTEMPT_SUBMITTED',
  'ASSESSMENT_ANSWER_GRADED',
  'CALENDAR_EVENT_CREATED',
  'CALENDAR_EVENT_UPDATED',
  'CALENDAR_EVENT_DELETED',
  'QNA_QUESTION_CREATED',
  'QNA_QUESTION_UPDATED',
  'QNA_QUESTION_DELETED',
  'QNA_QUESTION_STATUS_CHANGED',
  'QNA_ANSWER_CREATED',
  'QNA_ANSWER_UPDATED',
  'QNA_ANSWER_DELETED',
  'QNA_ANSWER_VERIFIED',
  'QNA_ANSWER_PINNED',
  'AI_CONVERSATION_DELETED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** "LOGIN_SUCCESS" -> "Login success" — avoids hand-maintaining 68 individual labels. */
export function formatAuditAction(action: string): string {
  const lower = action.toLowerCase().replaceAll('_', ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export interface AuditLogActor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actor: AuditLogActor | null;
  targetUser: AuditLogActor | null;
  ipAddress: string | null;
  metadata: unknown;
  createdAt: string;
}

export interface AuditLogListFilters {
  action?: AuditAction;
  actorId?: string;
  targetUserId?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  search?: string;
}

export interface AuditLogListParams extends AuditLogListFilters {
  page: number;
  pageSize: number;
  sortOrder?: SortOrder;
}
