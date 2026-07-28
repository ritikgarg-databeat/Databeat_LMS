export interface ListAuditLogsQueryDto {
  action?: string;
  actorId?: string;
  targetUserId?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  search?: string;
  page?: string;
  pageSize?: string;
  sortBy?: string;
  sortOrder?: string;
}
