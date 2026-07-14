import { DepartmentStatus, Role } from '@prisma/client';

import { env } from '@/config/env';
import { prisma } from '@/config/prisma';
import { logger } from '@/utils/logger';
import { hashPassword } from '@/utils/password.util';

const DEFAULT_DEPARTMENTS = ['Engineering', 'Sales', 'Human Resources', 'Customer Support'];

const DEFAULT_EXPERIENCE_LEVELS = [
  { name: 'Fresher', code: 'FRESHER' },
  { name: 'Experienced', code: 'EXPERIENCED' },
];

/** Mirrors the backfill convention used by the `organization_management` migration. */
function codeFromName(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

/**
 * Seed entry point (`npm run seed`). Creates only baseline reference data — the default
 * departments, experience levels, and the first Super Admin account — so the app has the
 * minimum it needs to be usable on a fresh database (ARCHITECTURE.md §20, milestones M1/M4).
 * No sample/demo content lives here; see `seed-demo.ts` for optional demo data.
 * Idempotent — safe to run multiple times.
 */
async function main(): Promise<void> {
  const departments = await Promise.all(
    DEFAULT_DEPARTMENTS.map((name) =>
      prisma.department.upsert({
        where: { name },
        update: {},
        create: { name, code: codeFromName(name), status: DepartmentStatus.ACTIVE },
      }),
    ),
  );
  logger.info(`Seeded ${departments.length} departments.`);

  const experienceLevels = await Promise.all(
    DEFAULT_EXPERIENCE_LEVELS.map((level) =>
      prisma.experienceLevel.upsert({ where: { code: level.code }, update: {}, create: level }),
    ),
  );
  logger.info(`Seeded ${experienceLevels.length} experience levels.`);

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  await prisma.user.upsert({
    where: { email: env.ADMIN_EMAIL },
    update: {},
    create: {
      firstName: 'Super',
      lastName: 'Admin',
      email: env.ADMIN_EMAIL,
      passwordHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
      isEmailVerified: true,
    },
  });
  logger.info(`Seeded Super Admin account: ${env.ADMIN_EMAIL} / ${env.ADMIN_PASSWORD} (change on first login)`);
}

main()
  .catch((error: unknown) => {
    logger.error('Seed failed', { error });
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
