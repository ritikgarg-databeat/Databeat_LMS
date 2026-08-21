import { env } from '@/config/env';
import { logger } from '@/utils/logger';

export interface PasswordResetDeliveryInput {
  to: string;
  resetUrl: string;
  expiresAt: Date;
}

/** Vendor-neutral email boundary. Production can connect SES, SendGrid, Postmark, etc. by webhook. */
export class PasswordResetDeliveryService {
  async send(input: PasswordResetDeliveryInput): Promise<boolean> {
    if (!env.EMAIL_WEBHOOK_URL) {
      logger.warn('Password reset email was queued but EMAIL_WEBHOOK_URL is not configured.');
      return false;
    }

    const response = await fetch(env.EMAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.EMAIL_WEBHOOK_BEARER_TOKEN
          ? { authorization: `Bearer ${env.EMAIL_WEBHOOK_BEARER_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        type: 'PASSWORD_RESET',
        to: input.to,
        resetUrl: input.resetUrl,
        expiresAt: input.expiresAt.toISOString(),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Password reset delivery webhook returned HTTP ${response.status}.`);
    }
    return true;
  }
}

export const passwordResetDeliveryService = new PasswordResetDeliveryService();
