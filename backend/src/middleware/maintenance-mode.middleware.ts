import { Role } from '@prisma/client';
import type { Request } from 'express';

import { API_PREFIX } from '@/constants/routes';
import { settingsService } from '@/modules/settings/settings.service';
import { ServiceUnavailableError } from '@/utils/app-error';

/**
 * Endpoints a blocked (non-SUPER_ADMIN) user may still reach while maintenance mode is on —
 * mirrors `require-password-change.middleware.ts`'s `ALLOWED_PATHS` precedent exactly: enough to
 * see who they are and sign out cleanly, nothing that touches actual platform data.
 */
const ALLOWED_PATHS = new Set<string>([
  `${API_PREFIX}/auth/logout`,
  `${API_PREFIX}/auth/me`,
  `${API_PREFIX}/auth/refresh`,
]);

/**
 * Server-side enforcement of the Platform Settings "maintenance mode" toggle (previously stored
 * but never read anywhere — see settings module). A SUPER_ADMIN is never blocked, so they can
 * always reach the platform to manage it (including turning maintenance mode back off). Every
 * other authenticated role is blocked with a 503 outside the small allowlist above.
 *
 * Called from `authenticate` (auth.middleware.ts) after `req.user` is set, the same way
 * `requirePasswordChange` already runs for every route that middleware protects — see that
 * file's doc comment for why this avoids touching each of the ~20 module route files separately.
 * Fresh (not-yet-authenticated) logins are handled separately in `auth.service.ts#login`, since
 * that path never goes through `authenticate` at all.
 */
export async function requireNotInMaintenance(req: Request): Promise<void> {
  if (!req.user || req.user.role === Role.SUPER_ADMIN) return;

  const active = await settingsService.isMaintenanceModeActive();
  if (!active) return;

  const path = req.originalUrl.split('?')[0] ?? req.originalUrl;
  if (ALLOWED_PATHS.has(path)) return;

  throw new ServiceUnavailableError(
    'The platform is currently under maintenance. Please try again shortly, or contact your Super Admin.',
  );
}
