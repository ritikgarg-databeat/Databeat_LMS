import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

import { env, isDevelopment } from '@/config/env';
import { logger } from '@/utils/logger';

/**
 * One shared Prisma client backed by a deliberately small pg pool. Prisma CLI commands keep
 * using DATABASE_URL directly through prisma.config.ts; only application traffic is routed to
 * Neon's PgBouncer endpoint below.
 */
const connectionUrl = new URL(env.DATABASE_URL);

// Neon documents runtime pooling by adding `-pooler` to the endpoint id. Doing this here lets a
// development .env keep the direct URL required by migrations without maintaining a secret
// second connection string. Production may already supply a pooled URL, in which case this is a
// no-op.
if (connectionUrl.hostname.endsWith('.neon.tech') && !connectionUrl.hostname.includes('-pooler.')) {
  const [endpointId, ...hostnameParts] = connectionUrl.hostname.split('.');
  if (endpointId?.startsWith('ep-') && hostnameParts.length > 0) {
    connectionUrl.hostname = `${endpointId}-pooler.${hostnameParts.join('.')}`;
  }
}
connectionUrl.searchParams.delete('sslmode');

const isWorkerProcess = /(?:^|[\\/])worker\.(?:ts|js)$/.test(process.argv[1] ?? '');
const configuredPoolMax = isWorkerProcess ? env.DATABASE_WORKER_POOL_MAX : env.DATABASE_POOL_MAX;
const configuredWarmConnections = isWorkerProcess
  ? env.DATABASE_WORKER_POOL_WARM_CONNECTIONS
  : env.DATABASE_POOL_WARM_CONNECTIONS;
const poolMax = Number.isFinite(configuredPoolMax) && configuredPoolMax > 0 ? configuredPoolMax : 4;
const warmConnectionCount = Math.min(
  poolMax,
  Number.isFinite(configuredWarmConnections) && configuredWarmConnections > 0
    ? configuredWarmConnections
    : poolMax,
);

const TRANSIENT_CONNECTION_ERROR_PATTERNS = [
  "Can't reach database server",
  'Connection terminated',
  'Connection refused',
  'ECONNRESET',
  'ETIMEDOUT',
  'Authentication timed out',
  'Unable to start a transaction in the given time',
];

function isTransientConnectionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    TRANSIENT_CONNECTION_ERROR_PATTERNS.some((pattern) => error.message.includes(pattern))
  );
}

const pool = new Pool({
  connectionString: connectionUrl.toString(),
  ssl: { rejectUnauthorized: true },
  // Opening many remote connections at once was the direct cause of 5-15 second portal calls.
  // Keep the small pre-warmed pool alive across normal demo/training pauses so the next login
  // does not pay a fresh remote authentication handshake.
  max: poolMax,
  idleTimeoutMillis: 15 * 60_000,
  connectionTimeoutMillis: 20_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

pool.on('error', (error) => {
  logger.error('Postgres pool error', { error: error.message });
});

function createPrismaClient() {
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter, log: isDevelopment ? ['warn', 'error'] : ['error'] });

  // A pooled connection can still be interrupted by a network or database restart. Retry one
  // transient operation once; validation/constraint/application errors are never retried.
  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (error) {
          if (!isTransientConnectionError(error)) throw error;
          logger.warn('Transient database connection error — retrying query once', {
            error: error instanceof Error ? error.message : error,
          });
          return query(args);
        }
      },
    },
  });
}

declare global {
  var __prisma: ReturnType<typeof createPrismaClient> | undefined;
}

export const prisma = global.__prisma ?? createPrismaClient();

if (isDevelopment) global.__prisma = prisma;

/** Open the bounded pool before the API accepts traffic, avoiding cold-request latency. */
export async function warmDatabasePool(): Promise<void> {
  const results = await Promise.allSettled(Array.from({ length: warmConnectionCount }, () => pool.connect()));
  for (const result of results) {
    if (result.status === 'fulfilled') result.value.release();
  }
  const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
  if (failed) throw failed.reason;
}

let disconnectPromise: Promise<void> | null = null;

/** Prisma does not own an externally supplied pg.Pool, so close both explicitly. */
export function disconnectDatabase(): Promise<void> {
  disconnectPromise ??= prisma
    .$disconnect()
    .then(() => pool.end())
    .then(() => undefined);
  return disconnectPromise;
}
