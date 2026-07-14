import type { NextFunction, Request, Response } from 'express';

import { API_PREFIX } from '@/constants/routes';
import { PasswordChangeRequiredError } from '@/utils/app-error';

/**
 * Endpoints a user with `mustChangePassword: true` may still reach — otherwise there'd be no
 * way to actually change the password, sign out, check who's signed in, or silently refresh
 * the (still-flagged) session. Every other authenticated route is blocked (Prompt 10 § Part 6).
 */
const ALLOWED_PATHS = new Set<string>([
  `${API_PREFIX}/auth/change-password`,
  `${API_PREFIX}/auth/logout`,
  `${API_PREFIX}/auth/me`,
  `${API_PREFIX}/auth/refresh`,
  `${API_PREFIX}/auth/validate`,
]);

/**
 * Server-side enforcement of "force password change on first login" — the client redirects
 * proactively (see the frontend route guard), but this is what actually stops the API call if
 * it doesn't. `mustChangePassword` is derived from `User.passwordChangedAt === null` (see
 * utils/user-mapper.util.ts / auth.service.ts#issueTokenPair) and baked into the access token,
 * so it's available on `req.user` the moment `authenticate` runs — this middleware MUST run
 * after that (it reads `req.user`), which is why `authenticate` invokes it directly rather than
 * requiring every module's router to remember to chain it on separately (see auth.middleware.ts).
 */
export function requirePasswordChange(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.mustChangePassword) {
    next();
    return;
  }

  const path = req.originalUrl.split('?')[0] ?? req.originalUrl;
  if (ALLOWED_PATHS.has(path)) {
    next();
    return;
  }

  throw new PasswordChangeRequiredError();
}
