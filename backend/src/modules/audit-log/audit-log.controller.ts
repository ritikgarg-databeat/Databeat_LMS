import type { Request, Response } from 'express';

import { BaseController } from '@/controllers/base.controller';
import { parsePaginationParams } from '@/utils/pagination.util';
import { assertValidRequest } from '@/utils/validation.util';

import type { ListAuditLogsQueryDto } from './audit-log.dto';
import { AuditLogService } from './audit-log.service';
import type { AuditLogListFilters, AuditLogSortField, SortOrder } from './audit-log.types';

// HTTP request handlers for the audit-log module. No business logic here — see audit-log.service.ts.
export class AuditLogController extends BaseController {
  constructor(protected readonly service: AuditLogService = new AuditLogService()) {
    super();
  }

  list = async (req: Request, res: Response): Promise<void> => {
    assertValidRequest(req);

    const query = req.query as ListAuditLogsQueryDto;
    const { page, pageSize } = parsePaginationParams(query);

    const filters: AuditLogListFilters = {
      action: query.action as AuditLogListFilters['action'],
      actorId: query.actorId,
      targetUserId: query.targetUserId,
      createdAtFrom: query.createdAtFrom,
      createdAtTo: query.createdAtTo,
      search: query.search,
    };

    const result = await this.service.list(
      filters,
      page,
      pageSize,
      (query.sortBy as AuditLogSortField) ?? 'createdAt',
      (query.sortOrder as SortOrder) ?? 'desc',
    );

    this.ok(res, result);
  };
}
