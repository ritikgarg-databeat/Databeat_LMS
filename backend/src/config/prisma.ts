import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

import { env, isDevelopment } from '@/config/env';
import { logger } from '@/utils/logger';

/**
 * Single shared Prisma client, guarded against creating a new instance (and a new
 * connection pool) on every nodemon/hot-reload cycle in development. Prisma 7 requires a
 * driver adapter at runtime instead of a schema-level `datasource.url`.
 *
 * Uses the standard `pg`-based adapter rather than `@prisma/adapter-neon`'s WebSocket
 * driver: that adapter is built for short-lived edge/serverless invocations (one
 * connection per request), and its pooled WS connection was observed going stale after
 * an idle period in this long-running Express process. `pg.Pool` is the right fit for a
 * persistent server, but on its own it isn't sufficient — see the two mitigations below.
 * Only `src/repositories` and `src/modules/<name>/<name>.repository.ts` files should
 * import this.
 */

// SSL is configured explicitly rather than left to be inferred from the connection
// string's `?sslmode=require` query param — `pg-connection-string` deprecated treating
// that as an alias for `verify-full` (full certificate-chain verification) and emits a
// warning on every connection purely from parsing the URL, even when an explicit `ssl`
// option is also given. Stripping the query param and passing `rejectUnauthorized: true`
// directly reproduces that same secure behavior without the ambiguity or the warning.
const connectionUrl = new URL(env.DATABASE_URL);
connectionUrl.searchParams.delete('sslmode');

const TRANSIENT_CONNECTION_ERROR_PATTERNS = [
  "Can't reach database server",
  'Connection terminated',
  'Connection refused',
  'ECONNRESET',
  'ETIMEDOUT',
];

function isTransientConnectionError(error: unknown): boolean {
  return error instanceof Error && TRANSIENT_CONNECTION_ERROR_PATTERNS.some((p) => error.message.includes(p));
}

function createPrismaClient() {
  const pool = new Pool({
    connectionString: connectionUrl.toString(),
    ssl: { rejectUnauthorized: true },
    // Mitigation 1: proactively close idle connections well before Neon's own proxy would
    // silently drop them server-side. A `pg.Pool` never health-checks an idle client before
    // handing it out — if the *server* killed the connection first, the pool doesn't find
    // out until a query actually fails on it. Cycling connections faster than Neon does
    // makes that race far less likely to matter in practice.
    idleTimeoutMillis: 10_000,
  });

  // An idle pooled client can still be dropped server-side between our own idle-timeout
  // checks (Neon's proxy, a network blip); without this handler that surfaces as an
  // unhandled 'error' event and crashes the process. Logging and letting `pg.Pool`
  // evict/replace the connection is correct.
  pool.on('error', (error) => {
    logger.error('Postgres pool error', { error: error.message });
  });

  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter, log: isDevelopment ? ['warn', 'error'] : ['error'] });

  // Mitigation 2: defense-in-depth backstop. Even with a short idle timeout, a connection
  // can still die in the split second between being handed out and being used (server
  // restart, network blip). Retrying exactly once, transparently, means that class of
  // failure is self-healing instead of surfacing as a 500 to whoever made the request.
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
          return await query(args);
        }
      },
    },
  });
}

declare global {
  var __prisma: ReturnType<typeof createPrismaClient> | undefined;
}

export const prisma = global.__prisma ?? createPrismaClient();

if (isDevelopment) {
  global.__prisma = prisma;
}
