import type { NextFunction, Request, Response } from 'express';

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
