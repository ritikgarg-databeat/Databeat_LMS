import {
  AuditLogRepository,
  type AuditLogListFilters,
  type AuditLogSortField,
  type SortOrder,
} from '@/repositories/audit-log.repository';
import { BaseService } from '@/services/base.service';
import type { PaginatedData } from '@/types/common';
import { buildPaginationMeta } from '@/utils/pagination.util';

import type { AuditLogEntryView } from './audit-log.types';

// Business logic for the audit-log module's (Super Admin-only) read path. The write path
// (`auditLogService.record()`, services/audit-log.service.ts) is a separate, cross-cutting
// singleton every other module already imports directly — this service only ever reads.
export class AuditLogService extends BaseService {
  constructor(protected readonly repository: AuditLogRepository = new AuditLogRepository()) {
    super();
  }

  async list(
    filters: AuditLogListFilters,
    page: number,
    pageSize: number,
    sortBy: AuditLogSortField,
    sortOrder: SortOrder,
  ): Promise<PaginatedData<AuditLogEntryView>> {
    const { items, total } = await this.repository.findMany(
      filters,
      (page - 1) * pageSize,
      pageSize,
      sortBy,
      sortOrder,
    );
    return { items: items.map(this.toEntryView), meta: buildPaginationMeta(page, pageSize, total) };
  }

  private toEntryView(entry: {
    id: string;
    action: string;
    actor: { id: string; firstName: string; lastName: string; email: string } | null;
    targetUser: { id: string; firstName: string; lastName: string; email: string } | null;
    ipAddress: string | null;
    metadata: unknown;
    createdAt: Date;
  }): AuditLogEntryView {
    return {
      id: entry.id,
      action: entry.action,
      actor: entry.actor,
      targetUser: entry.targetUser,
      ipAddress: entry.ipAddress,
      metadata: entry.metadata,
      createdAt: entry.createdAt,
    };
  }
}
