export type { AuditLogListFilters, AuditLogSortField, SortOrder } from '@/repositories/audit-log.repository';

export interface AuditLogActorView {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface AuditLogEntryView {
  id: string;
  action: string;
  actor: AuditLogActorView | null;
  targetUser: AuditLogActorView | null;
  ipAddress: string | null;
  metadata: unknown;
  createdAt: Date;
}
