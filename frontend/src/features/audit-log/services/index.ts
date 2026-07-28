import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse, PaginatedData } from '@/types/api';

import type { AuditLogEntry, AuditLogListParams } from '../types';

export const auditLogApi = {
  async list(params: AuditLogListParams): Promise<PaginatedData<AuditLogEntry>> {
    const { data } = await apiClient.get<ApiSuccessResponse<PaginatedData<AuditLogEntry>>>('/audit-logs', {
      params,
    });
    return data.data;
  },
};
