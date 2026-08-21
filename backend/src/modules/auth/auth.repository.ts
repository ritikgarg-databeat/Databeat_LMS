import { BaseRepository } from '@/repositories/base.repository';

export interface CreateRefreshTokenInput {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface CreatePasswordResetTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  requestedIp?: string | null;
}

// Data-access layer for the auth module. Only this class may query Prisma directly
// once models exist (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly.
export class AuthRepository extends BaseRepository {
  findUserByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  findUserById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }

  updateLastLogin(userId: string, lastLogin = new Date()) {
    return this.db.user.update({ where: { id: userId }, data: { lastLogin } });
  }

  updatePassword(userId: string, passwordHash: string) {
    return this.db.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
  }

  createRefreshToken(input: CreateRefreshTokenInput) {
    return this.db.refreshToken.create({ data: input });
  }

  findRefreshTokenById(id: string) {
    return this.db.refreshToken.findUnique({ where: { id } });
  }

  revokeRefreshToken(id: string, replacedById?: string) {
    return this.db.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedById },
    });
  }

  revokeAllUserRefreshTokens(userId: string) {
    return this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  createPasswordResetToken(input: CreatePasswordResetTokenInput) {
    return this.db.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: { userId: input.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      return tx.passwordResetToken.create({ data: input });
    });
  }

  findValidPasswordResetToken(tokenHash: string, now: Date) {
    return this.db.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now }, user: { isActive: true } },
      include: { user: true },
    });
  }

  async consumePasswordResetToken(tokenId: string, userId: string, passwordHash: string): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: tokenId, userId, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) return false;

      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, passwordChangedAt: new Date() },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      return true;
    });
  }
}
