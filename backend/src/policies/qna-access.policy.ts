import type { Prisma, Role } from '@prisma/client';

import { activeGroupScope } from './group-access.policy';

/** Visibility enforced consistently across Q&A questions, answers, comments, and votes. */
export function qnaQuestionAccessScope(
  userId: string,
  role: Role,
  includeAuthor = false,
): Prisma.QnaQuestionWhereInput {
  if (role === 'SUPER_ADMIN') return { deletedAt: null };

  const access: Prisma.QnaQuestionWhereInput[] = [{ visibility: 'ORGANIZATION' }];
  if (includeAuthor) access.push({ authorId: userId });
  access.push(
    role === 'TRAINER'
      ? {
          visibility: 'DEPARTMENT',
          department: {
            OR: [
              { users: { some: { id: userId, isActive: true } } },
              { groups: { some: { trainerId: userId, status: 'ACTIVE', deletedAt: null } } },
            ],
          },
        }
      : {
          visibility: 'DEPARTMENT',
          department: { users: { some: { id: userId, isActive: true } } },
        },
  );
  access.push(
    role === 'TRAINER'
      ? { visibility: 'GROUP', group: { trainerId: userId, status: 'ACTIVE', deletedAt: null } }
      : { visibility: 'GROUP', group: activeGroupScope({ members: { some: { userId } } }) },
  );

  return { deletedAt: null, OR: access };
}
