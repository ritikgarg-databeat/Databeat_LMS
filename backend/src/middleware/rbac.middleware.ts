import type { NextFunction, Request, Response } from 'express';

import { ROLE_PERMISSIONS, type Permission } from '@/constants/permissions';
import type { Role } from '@/constants/roles';
import { ForbiddenError, UnauthorizedError } from '@/utils/app-error';

/** Coarse role check. Must run after `authenticate` (relies on `req.user`). */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication is required to access this resource.');
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError("You don't have permission to perform this action.");
    }
    next();
  };
}

/**
 * Fine-grained permission check, backed by the static `ROLE_PERMISSIONS` map today
 * (ARCHITECTURE.md §10 — this is the "future-ready" seam a DB-driven `RolePermission`
 * table replaces later without changing any call site). Must run after `authenticate`.
 */
export function requirePermission(...required: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication is required to access this resource.');
    }
    const granted = ROLE_PERMISSIONS[req.user.role];
    const hasAll = required.every((permission) => granted.includes(permission));
    if (!hasAll) {
      throw new ForbiddenError("You don't have permission to perform this action.");
    }
    next();
  };
}
