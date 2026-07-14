import { AuditLogRepository, type RecordAuditLogInput } from '@/repositories/audit-log.repository';
import { BaseService } from '@/services/base.service';
import { logger } from '@/utils/logger';

/**
 * Shared by every module that performs a security-relevant action (ARCHITECTURE.md §17).
 * Failures to write an audit entry are logged but never thrown — an audit-log outage must
 * not block the user-facing action (e.g. a login) that triggered it.
 */
export class AuditLogService extends BaseService {
  constructor(private readonly repository: AuditLogRepository = new AuditLogRepository()) {
    super();
  }

  async record(input: RecordAuditLogInput): Promise<void> {
    try {
      await this.repository.record(input);
    } catch (error) {
      logger.error('Failed to write audit log', { error, input });
    }
  }
}

export const auditLogService = new AuditLogService();
