import type { Prisma } from '@prisma/client';

/**
 * Canonical lifecycle boundary for every learner-facing group relationship.
 *
 * A membership row may remain after a cohort is archived or soft-deleted so historical reports
 * stay intact. It must not, however, keep granting live course, assessment, calendar, AI, or Q&A
 * access. Keeping this fragment in one place prevents each feature from independently forgetting
 * one half of the lifecycle rule.
 */
export const ACTIVE_GROUP_SCOPE = {
  status: 'ACTIVE',
  deletedAt: null,
} satisfies Prisma.GroupWhereInput;

export function activeGroupScope(extra: Prisma.GroupWhereInput = {}): Prisma.GroupWhereInput {
  return { ...extra, ...ACTIVE_GROUP_SCOPE };
}

export function activeGroupMembershipWhere(
  userId: string,
  extraGroup: Prisma.GroupWhereInput = {},
): Prisma.GroupMemberWhereInput {
  return {
    userId,
    group: activeGroupScope(extraGroup),
  };
}
