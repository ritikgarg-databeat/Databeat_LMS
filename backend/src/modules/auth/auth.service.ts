import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Role } from '@prisma/client';
import ms from 'ms';

import { env } from '@/config/env';
import { settingsService } from '@/modules/settings/settings.service';
import { auditLogService } from '@/services/audit-log.service';
import { BaseService } from '@/services/base.service';
import { passwordResetDeliveryService } from '@/services/password-reset-delivery.service';
import {
  BadRequestError,
  ForbiddenError,
  ServiceUnavailableError,
  UnauthorizedError,
} from '@/utils/app-error';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/utils/jwt.util';
import { logger } from '@/utils/logger';
import { comparePassword, hashPassword } from '@/utils/password.util';
import { toSafeUser } from '@/utils/user-mapper.util';

import { AuthRepository } from './auth.repository';
import type { AccessTokenPayload, RefreshTokenPayload, SafeUser } from './auth.types';

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface IssuedSession {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
  /** Echoed back so the controller can re-apply the same cookie maxAge on rotation. */
  rememberMe: boolean;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Business logic for the auth module. Controllers call into this layer only.
export class AuthService extends BaseService {
  constructor(protected readonly repository: AuthRepository = new AuthRepository()) {
    super();
  }

  async login(
    email: string,
    password: string,
    ctx: RequestContext,
    rememberMe = false,
  ): Promise<IssuedSession> {
    const user = await this.repository.findUserByEmail(email);

    if (!user) {
      await auditLogService.record({
        action: 'LOGIN_FAILED',
        ipAddress: ctx.ipAddress,
        metadata: { email },
      });
      throw new UnauthorizedError('Invalid email or password.');
    }

    if (!user.isActive) {
      await auditLogService.record({
        action: 'LOGIN_FAILED',
        actorId: user.id,
        ipAddress: ctx.ipAddress,
        metadata: { reason: 'inactive' },
      });
      throw new ForbiddenError('This account has been disabled. Contact your administrator.');
    }

    const passwordMatches = await comparePassword(password, user.passwordHash);
    if (!passwordMatches) {
      await auditLogService.record({
        action: 'LOGIN_FAILED',
        actorId: user.id,
        ipAddress: ctx.ipAddress,
        metadata: { reason: 'bad_password' },
      });
      throw new UnauthorizedError('Invalid email or password.');
    }

    // This path never goes through `authenticate`/`requireNotInMaintenance` (there's no token
    // yet), so a fresh non-SUPER_ADMIN login needs its own maintenance-mode check — checked only
    // after credentials are verified, so a blocked/wrong password still reports as such rather
    // than leaking "this account would have worked" via a different error.
    if (user.role !== Role.SUPER_ADMIN && (await settingsService.isMaintenanceModeActive())) {
      throw new ServiceUnavailableError(
        'The platform is currently under maintenance. Please try again shortly, or contact your Super Admin.',
      );
    }

    const lastLogin = new Date();
    const [{ accessToken, refreshToken }] = await Promise.all([
      this.issueTokenPair(user.id, user.role, ctx, rememberMe, user.passwordChangedAt === null),
      this.repository.updateLastLogin(user.id, lastLogin),
      auditLogService.record({ action: 'LOGIN_SUCCESS', actorId: user.id, ipAddress: ctx.ipAddress }),
    ]);

    return { user: toSafeUser({ ...user, lastLogin }), accessToken, refreshToken, rememberMe };
  }

  async logout(refreshToken: string | undefined, ctx: RequestContext): Promise<void> {
    if (!refreshToken) return;

    try {
      const payload = verifyRefreshToken<RefreshTokenPayload>(refreshToken);
      await this.repository.revokeRefreshToken(payload.jti);
      await auditLogService.record({ action: 'LOGOUT', actorId: payload.sub, ipAddress: ctx.ipAddress });
    } catch {
      // Token already invalid/expired — logout is idempotent, nothing else to do.
    }
  }

  async refresh(refreshToken: string | undefined, ctx: RequestContext): Promise<IssuedSession> {
    if (!refreshToken) {
      throw new UnauthorizedError('No active session found.');
    }

    let payload: RefreshTokenPayload;
    try {
      payload = verifyRefreshToken<RefreshTokenPayload>(refreshToken);
    } catch {
      throw new UnauthorizedError('Your session has expired. Please sign in again.');
    }

    const stored = await this.repository.findRefreshTokenById(payload.jti);

    if (!stored || stored.tokenHash !== hashToken(refreshToken)) {
      throw new UnauthorizedError('Your session is no longer valid. Please sign in again.');
    }

    if (stored.revokedAt) {
      // A revoked (already-rotated) token was presented again — possible theft/replay.
      // Kill every session for this user as a precaution (ARCHITECTURE.md §9).
      await this.repository.revokeAllUserRefreshTokens(stored.userId);
      throw new UnauthorizedError('Session invalidated for security reasons. Please sign in again.');
    }

    const user = await this.repository.findUserById(stored.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Your session is no longer valid. Please sign in again.');
    }

    const {
      accessToken,
      refreshToken: newRefreshToken,
      jti,
    } = await this.issueTokenPair(
      user.id,
      user.role,
      ctx,
      payload.rememberMe,
      user.passwordChangedAt === null,
    );
    await this.repository.revokeRefreshToken(stored.id, jti);

    return {
      user: toSafeUser(user),
      accessToken,
      refreshToken: newRefreshToken,
      rememberMe: payload.rememberMe ?? false,
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError('Your session is no longer valid. Please sign in again.');
    }

    const matches = await comparePassword(currentPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestError('Current password is incorrect.');
    }

    const newHash = await hashPassword(newPassword);
    await this.repository.updatePassword(userId, newHash);

    // Revoke every existing session (including this one) — the caller re-issues a fresh
    // pair below so the device the change was made from stays signed in.
    await this.repository.revokeAllUserRefreshTokens(userId);

    await auditLogService.record({ action: 'PASSWORD_CHANGED', actorId: userId });
  }

  /**
   * Issues a fresh token pair for an already-verified user (e.g. right after a password change).
   * `previousRefreshToken` — the cookie presented on the request that triggered this reissue — is
   * decoded (best-effort, signature/expiry only, no DB lookup needed) purely to recover its
   * `rememberMe` flag, so a "remembered" session doesn't silently downgrade to the default
   * 7-day expiry the moment the user changes their password.
   */
  async reissueSession(
    userId: string,
    ctx: RequestContext,
    previousRefreshToken?: string,
  ): Promise<{ user: SafeUser; accessToken: string; refreshToken: string; rememberMe: boolean }> {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError('Your session is no longer valid. Please sign in again.');
    }
    const rememberMe = this.decodeRememberMe(previousRefreshToken);
    const { accessToken, refreshToken } = await this.issueTokenPair(
      user.id,
      user.role,
      ctx,
      rememberMe,
      user.passwordChangedAt === null,
    );
    return { user: toSafeUser(user), accessToken, refreshToken, rememberMe };
  }

  private decodeRememberMe(refreshToken: string | undefined): boolean {
    if (!refreshToken) return false;
    try {
      return verifyRefreshToken<RefreshTokenPayload>(refreshToken).rememberMe ?? false;
    } catch {
      return false;
    }
  }

  async getMe(userId: string): Promise<SafeUser> {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError('Your session is no longer valid. Please sign in again.');
    }
    return toSafeUser(user);
  }

  /**
   * Always responds as if it succeeded, whether or not the email exists — never reveal
   * account existence via timing/response differences (ARCHITECTURE.md §17). Delivery uses the
   * configured password-reset webhook and remains best-effort so it cannot leak account presence.
   */
  async forgotPassword(email: string, ctx: RequestContext = {}): Promise<void> {
    const startedAt = Date.now();
    const user = await this.repository.findUserByEmail(email);
    if (user?.isActive) {
      const rawToken = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_EXPIRES_MINUTES * 60_000);
      await this.repository.createPasswordResetToken({
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt,
        requestedIp: ctx.ipAddress,
      });

      const resetUrl = new URL(env.PASSWORD_RESET_URL);
      resetUrl.searchParams.set('token', rawToken);
      try {
        await passwordResetDeliveryService.send({ to: user.email, resetUrl: resetUrl.toString(), expiresAt });
      } catch (error) {
        logger.error('Password reset delivery failed', { error, userId: user.id });
      }

      await auditLogService.record({
        action: 'PASSWORD_RESET_REQUESTED',
        actorId: user.id,
        ipAddress: ctx.ipAddress,
      });
    }

    const remainingMs = 500 - (Date.now() - startedAt);
    if (remainingMs > 0) await new Promise((resolve) => setTimeout(resolve, remainingMs));
  }

  async resetPassword(token: string, newPassword: string, ctx: RequestContext = {}): Promise<void> {
    const stored = await this.repository.findValidPasswordResetToken(hashToken(token), new Date());
    if (!stored) throw new BadRequestError('This password reset link is invalid or has expired.');

    const passwordHash = await hashPassword(newPassword);
    const consumed = await this.repository.consumePasswordResetToken(stored.id, stored.userId, passwordHash);
    if (!consumed) throw new BadRequestError('This password reset link is invalid or has expired.');

    await auditLogService.record({
      action: 'PASSWORD_RESET_COMPLETED',
      actorId: stored.userId,
      ipAddress: ctx.ipAddress,
    });
  }

  /**
   * `rememberMe` is carried in the refresh JWT's own payload (not a new RefreshToken column) so
   * that `refresh()`'s token rotation can re-derive the same extended expiry on every silent
   * refresh, without a schema change. Absent/false reproduces the exact pre-existing expiry.
   *
   * `mustChangePassword` is always recomputed fresh by the caller from the user's CURRENT
   * `passwordChangedAt` at the moment of issuance (never copied from an old token) — see
   * auth.types.ts SafeUser and utils/user-mapper.util.ts. This is what makes the very next
   * token minted after a password change (via `reissueSession`) correctly flip to `false`.
   */
  private async issueTokenPair(
    userId: string,
    role: SafeUser['role'],
    ctx: RequestContext,
    rememberMe = false,
    mustChangePassword = false,
  ): Promise<{ accessToken: string; refreshToken: string; jti: string }> {
    const jti = randomUUID();
    const accessPayload: AccessTokenPayload = { sub: userId, role, mustChangePassword };
    const refreshPayload: RefreshTokenPayload = { sub: userId, jti, rememberMe };

    const expiresIn = rememberMe ? env.REFRESH_EXPIRES_REMEMBER_ME : env.REFRESH_EXPIRES;
    const accessToken = signAccessToken(accessPayload);
    const refreshToken = signRefreshToken(refreshPayload, expiresIn);

    await this.repository.createRefreshToken({
      id: jti,
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + ms(expiresIn as ms.StringValue)),
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });

    return { accessToken, refreshToken, jti };
  }
}
