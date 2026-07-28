import { Role } from '@prisma/client';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { requireRole } from '@/middleware/rbac.middleware';

import { AuditLogController } from './audit-log.controller';
import { auditLogValidation } from './audit-log.validation';

/**
 * Route definitions for the audit-log module. Mounted at `/audit-logs` in src/routes/index.ts.
 * Super Admin-only, org-wide — there is no Trainer-scoped view, unlike Users/Groups/Reports.
 */
const router = Router();
const controller = new AuditLogController();

router.use(authenticate);

router.get('/', requireRole(Role.SUPER_ADMIN), auditLogValidation.list, controller.list);

export default router;
