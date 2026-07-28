import type { NextFunction, Request, Response } from 'express';
import { TokenExpiredError } from 'jsonwebtoken';

import type { AccessTokenPayload } from '@/modules/auth/auth.types';
import { UnauthorizedError } from '@/utils/app-error';
import { verifyAccessToken } from '@/utils/jwt.util';

import { requireNotInMaintenance } from './maintenance-mode.middleware';
import { requirePasswordChange } from './require-password-change.middleware';

/**
 * Verifies the `Authorization: Bearer <token>` access token and attaches `req.user`.
 * Real implementation — the auth module is now live (ARCHITECTURE.md §9). Distinguishes
 * an expired token from an otherwise-invalid one so the frontend knows to try `/auth/refresh`
 * rather than immediately forcing a full re-login.
 *
 * Delegates to `requireNotInMaintenance` then `requirePasswordChange` as its last steps (rather
 * than calling `next()` directly) so both gates run for every route `authenticate` protects —
 * which, given every module router's own `router.use(authenticate)`, is effectively every
 * authenticated route in the app — without having to separately wire two more middlewares into
 * each of those ~20 module route files. `async` since the maintenance-mode check reads (a
 * briefly-cached copy of) Platform Settings; Express 5 forwards a rejected promise from an async
 * middleware to the error handler automatically, so no wrapper is needed.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authentication token was not provided.');
  }

  const token = header.slice('Bearer '.length);

  // Only JWT verification is try/caught — the gates below throw their own distinct error types,
  // which must propagate as-is rather than being swallowed and remapped to a generic "invalid
  // token" 401 by the catch block below.
  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken<AccessTokenPayload>(token);
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new UnauthorizedError('Access token has expired.');
    }
    throw new UnauthorizedError('Invalid authentication token.');
  }

  req.user = { id: payload.sub, role: payload.role, mustChangePassword: payload.mustChangePassword ?? false };
  await requireNotInMaintenance(req);
  requirePasswordChange(req, res, next);
}
