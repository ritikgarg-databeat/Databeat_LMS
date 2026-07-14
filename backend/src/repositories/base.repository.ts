import { prisma } from '@/config/prisma';

/**
 * Base class for module repositories (`src/modules/<name>/<name>.repository.ts`). Holds the shared
 * Prisma client so subclasses don't each import it separately. No query methods yet —
 * those are added per-model once the Prisma schema has models (ARCHITECTURE.md §6).
 */
export abstract class BaseRepository {
  protected readonly db = prisma;
}
