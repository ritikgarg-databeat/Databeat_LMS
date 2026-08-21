import type { NextFunction, Request, Response } from 'express';
import { TokenExpiredError } from 'jsonwebtoken';

import { AuthRepository } from '@/modules/auth/auth.repository';
import type { AccessTokenPayload } from '@/modules/auth/auth.types';
import { UnauthorizedError } from '@/utils/app-error';
import { verifyAccessToken } from '@/utils/jwt.util';

import { requireNotInMaintenance } from './maintenance-mode.middleware';
import { requirePasswordChange } from './require-password-change.middleware';

const authRepository = new AuthRepository();
type CurrentUser = Awaited<ReturnType<AuthRepository['findUserById']>>;
const currentUserLookups = new Map<string, Promise<CurrentUser>>();
const currentUserCache = new Map<string, { value: CurrentUser; expiresAt: number }>();
const CURRENT_USER_CACHE_TTL_MS = 5_000;
const CURRENT_USER_CACHE_MAX_ENTRIES = 1_000;

function findCurrentUser(userId: string): Promise<CurrentUser> {
  const cached = currentUserCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
  if (cached) currentUserCache.delete(userId);

  const existing = currentUserLookups.get(userId);
  if (existing) return existing;
  const lookup = authRepository
    .findUserById(userId)
    .then((value) => {
      currentUserCache.set(userId, { value, expiresAt: Date.now() + CURRENT_USER_CACHE_TTL_MS });
      while (currentUserCache.size > CURRENT_USER_CACHE_MAX_ENTRIES) {
        const oldestKey = currentUserCache.keys().next().value as string | undefined;
        if (!oldestKey) break;
        currentUserCache.delete(oldestKey);
      }
      return value;
    })
    .finally(() => currentUserLookups.delete(userId));
  currentUserLookups.set(userId, lookup);
  return lookup;
}

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

  // Re-check security-sensitive state so deactivation, role changes and password resets take
  // effect promptly instead of waiting for a previously issued access token to expire. A portal
  // opens several authenticated requests together, so share the lookup and its result for five
  // seconds. This bounds security-state propagation while avoiding one remote DB read per widget.
  const currentUser = await findCurrentUser(payload.sub);
  if (!currentUser?.isActive) throw new UnauthorizedError('This account is inactive.');
  if (
    payload.iat &&
    currentUser.passwordChangedAt &&
    currentUser.passwordChangedAt.getTime() > payload.iat * 1000
  ) {
    throw new UnauthorizedError('Your credentials changed. Please sign in again.');
  }

  req.user = {
    id: currentUser.id,
    role: currentUser.role,
    mustChangePassword: currentUser.passwordChangedAt === null,
  };
  await requireNotInMaintenance(req);
  requirePasswordChange(req, res, next);
}
