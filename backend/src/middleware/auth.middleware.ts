import type { NextFunction, Request, Response } from 'express';
import { TokenExpiredError } from 'jsonwebtoken';

import type { AccessTokenPayload } from '@/modules/auth/auth.types';
import { UnauthorizedError } from '@/utils/app-error';
import { verifyAccessToken } from '@/utils/jwt.util';

import { requirePasswordChange } from './require-password-change.middleware';

/**
 * Verifies the `Authorization: Bearer <token>` access token and attaches `req.user`.
 * Real implementation — the auth module is now live (ARCHITECTURE.md §9). Distinguishes
 * an expired token from an otherwise-invalid one so the frontend knows to try `/auth/refresh`
 * rather than immediately forcing a full re-login.
 *
 * Delegates to `requirePasswordChange` as its last step (rather than calling `next()` directly)
 * so the force-password-change gate (Prompt 10 § Part 6) runs for every route `authenticate`
 * protects — which, given every module router's own `router.use(authenticate)`, is effectively
 * every authenticated route in the app — without having to separately wire a second middleware
 * into each of those ~20 module route files.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authentication token was not provided.');
  }

  const token = header.slice('Bearer '.length);

  // Only JWT verification is try/caught — `requirePasswordChange` throws its own distinct
  // `PasswordChangeRequiredError`, which must propagate as-is rather than being swallowed
  // and remapped to a generic "invalid token" 401 by the catch block below.
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
  requirePasswordChange(req, res, next);
}
