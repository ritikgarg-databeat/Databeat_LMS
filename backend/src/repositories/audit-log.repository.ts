import type { AuditAction, Prisma } from '@prisma/client';

import { BaseRepository } from '@/repositories/base.repository';

export interface RecordAuditLogInput {
  action: AuditAction;
  actorId?: string | null;
  targetUserId?: string | null;
  ipAddress?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export class AuditLogRepository extends BaseRepository {
  async record(input: RecordAuditLogInput) {
    return this.db.auditLog.create({ data: input });
  }
}
