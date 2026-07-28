import type { AuditAction, Prisma } from '@prisma/client';

import { BaseRepository } from '@/repositories/base.repository';

export interface RecordAuditLogInput {
  action: AuditAction;
  actorId?: string | null;
  targetUserId?: string | null;
  ipAddress?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface AuditLogListFilters {
  action?: AuditAction;
  actorId?: string;
  targetUserId?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  search?: string;
}

export type AuditLogSortField = 'createdAt';
export type SortOrder = 'asc' | 'desc';

const ACTOR_SELECT = { id: true, firstName: true, lastName: true, email: true } as const;

function buildWhere(filters: AuditLogListFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.action) where.action = filters.action;
  if (filters.actorId) where.actorId = filters.actorId;
  if (filters.targetUserId) where.targetUserId = filters.targetUserId;
  if (filters.createdAtFrom || filters.createdAtTo) {
    where.createdAt = {
      ...(filters.createdAtFrom ? { gte: new Date(filters.createdAtFrom) } : {}),
      ...(filters.createdAtTo ? { lte: new Date(filters.createdAtTo) } : {}),
    };
  }
  if (filters.search) {
    const nameMatch: Prisma.UserWhereInput = {
      OR: [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ],
    };
    where.OR = [{ actor: nameMatch }, { targetUser: nameMatch }];
  }

  return where;
}

// `AuditLogService.record()` (services/audit-log.service.ts) is a write-only sink called from
// every other module — this repository is the one place both that write path AND the Super
// Admin-only read path (modules/audit-log) touch the AuditLog model directly, mirroring how
// modules/notifications and modules/groups already share a single repository across concerns.
export class AuditLogRepository extends BaseRepository {
  async record(input: RecordAuditLogInput) {
    return this.db.auditLog.create({ data: input });
  }

  async findMany(
    filters: AuditLogListFilters,
    skip: number,
    take: number,
    sortBy: AuditLogSortField = 'createdAt',
    sortOrder: SortOrder = 'desc',
  ) {
    const where = buildWhere(filters);
    const [items, total] = await Promise.all([
      this.db.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: { actor: { select: ACTOR_SELECT }, targetUser: { select: ACTOR_SELECT } },
      }),
      this.db.auditLog.count({ where }),
    ]);
    return { items, total };
  }
}
