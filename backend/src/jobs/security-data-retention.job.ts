import { env } from '@/config/env';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';

export async function runSecurityDataRetentionJob(): Promise<void> {
  const cutoff = new Date(Date.now() - env.EXPIRED_SECURITY_DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  try {
    const [rateLimits, resetTokens, refreshTokens] = await prisma.$transaction([
      prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: cutoff } } }),
      prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
      prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
    ]);
    logger.info('Security data retention job completed', {
      rateLimitBucketsDeleted: rateLimits.count,
      passwordResetTokensDeleted: resetTokens.count,
      refreshTokensDeleted: refreshTokens.count,
      cutoff,
    });
  } catch (error) {
    logger.error('Security data retention job failed', { error });
  }
}
