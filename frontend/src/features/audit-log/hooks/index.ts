import { useQuery } from '@tanstack/react-query';

import { auditLogApi } from '../services';
import type { AuditLogListParams } from '../types';

const AUDIT_LOGS_QUERY_KEY = 'audit-logs';

export function useAuditLogsQuery(params: AuditLogListParams) {
  return useQuery({
    queryKey: [AUDIT_LOGS_QUERY_KEY, params],
    queryFn: () => auditLogApi.list(params),
    placeholderData: (previous) => previous,
  });
}
