import path from 'node:path';

import dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

dotenv.config();

/**
 * Prisma 7 config file (replaces the old `"prisma"` key in package.json). Points the CLI
 * at the schema location required by the foundation spec (`src/prisma/schema.prisma`) and
 * supplies the connection string for CLI commands (migrate/studio/db pull). The running
 * app does NOT use this file — it builds its own Neon driver adapter in `config/prisma.ts`
 * (Prisma 7 dropped the schema-level `datasource.url` in favor of adapters at runtime).
 */
export default defineConfig({
  schema: path.join('src', 'prisma', 'schema.prisma'),
  datasource: {
    url: env('DATABASE_URL'),
  },
});
