import { BaseRepository } from '@/repositories/base.repository';

export interface CreateRefreshTokenInput {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
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

  updateLastLogin(userId: string) {
    return this.db.user.update({ where: { id: userId }, data: { lastLogin: new Date() } });
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
}
