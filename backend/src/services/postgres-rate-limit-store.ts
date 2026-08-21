import { createHash } from 'node:crypto';

import type { IncrementResponse, Options, Store } from 'express-rate-limit';

import { env } from '@/config/env';
import { prisma } from '@/config/prisma';

interface BucketRow {
  hits: number;
  resetAt: Date;
}

export class PostgresRateLimitStore implements Store {
  private windowMs = 60_000;

  constructor(private readonly namespacePrefix: string) {}

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const bucketKey = this.bucketKey(key);
    const now = new Date();
    const nextResetAt = new Date(now.getTime() + this.windowMs);
    const rows = await prisma.$queryRaw<BucketRow[]>`
      INSERT INTO "rate_limit_buckets" ("key", "hits", "resetAt", "updatedAt")
      VALUES (${bucketKey}, 1, ${nextResetAt}, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE
          WHEN "rate_limit_buckets"."resetAt" <= ${now} THEN 1
          ELSE "rate_limit_buckets"."hits" + 1
        END,
        "resetAt" = CASE
          WHEN "rate_limit_buckets"."resetAt" <= ${now} THEN ${nextResetAt}
          ELSE "rate_limit_buckets"."resetAt"
        END,
        "updatedAt" = ${now}
      RETURNING "hits", "resetAt"
    `;
    const bucket = rows[0];
    if (!bucket) throw new Error('Rate-limit counter update returned no row.');
    return { totalHits: bucket.hits, resetTime: bucket.resetAt };
  }

  async decrement(key: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE "rate_limit_buckets"
      SET "hits" = GREATEST("hits" - 1, 0), "updatedAt" = NOW()
      WHERE "key" = ${this.bucketKey(key)}
    `;
  }

  async resetKey(key: string): Promise<void> {
    await prisma.$executeRaw`DELETE FROM "rate_limit_buckets" WHERE "key" = ${this.bucketKey(key)}`;
  }

  private bucketKey(key: string): string {
    return `${this.namespacePrefix}:${createHash('sha256').update(key).digest('hex')}`;
  }
}

export function createRateLimitStore(prefix: string): Store | undefined {
  return env.RATE_LIMIT_STORE === 'postgres' ? new PostgresRateLimitStore(prefix) : undefined;
}
