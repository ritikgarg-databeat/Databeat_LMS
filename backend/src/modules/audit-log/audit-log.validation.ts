import { AuditAction } from '@prisma/client';
import { query } from 'express-validator';

import { paginationQueryValidators } from '@/validators/common.validators';

export const auditLogValidation = {
  list: [
    ...paginationQueryValidators,
    query('action').optional({ values: 'falsy' }).isIn(Object.values(AuditAction)),
    query('actorId').optional({ values: 'falsy' }).isUUID(),
    query('targetUserId').optional({ values: 'falsy' }).isUUID(),
    query('createdAtFrom').optional({ values: 'falsy' }).isISO8601(),
    query('createdAtTo').optional({ values: 'falsy' }).isISO8601(),
    query('search').optional().isString().trim(),
    query('sortBy').optional().isIn(['createdAt']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ],
};
