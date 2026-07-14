import type { Prisma } from '@prisma/client';

import { BaseRepository } from '@/repositories/base.repository';

import { TAG_LIST_LIMIT, type TagListFilters } from './qna-tags.types';

function buildWhere(filters: TagListFilters): Prisma.QnaTagWhereInput {
  const where: Prisma.QnaTagWhereInput = {};
  if (filters.search) {
    where.name = { contains: filters.search, mode: 'insensitive' };
  }
  return where;
}

const listInclude = {
  // QnaQuestionTag rows survive question soft-delete (softDelete never unlinks tags), so the
  // count must look through to the question's own deletedAt — otherwise a tag whose only
  // question was deleted still advertises a nonzero questionCount while `?tag=` finds nothing.
  _count: { select: { questions: { where: { question: { deletedAt: null } } } } },
} satisfies Prisma.QnaTagInclude;

export type QnaTagListRow = Prisma.QnaTagGetPayload<{ include: typeof listInclude }>;

// Data-access layer for the qna-tags module. Only this class may query Prisma directly
// (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly.
export class QnaTagsRepository extends BaseRepository {
  findMany(filters: TagListFilters): Promise<QnaTagListRow[]> {
    const where = buildWhere(filters);
    return this.db.qnaTag.findMany({
      where,
      take: TAG_LIST_LIMIT,
      orderBy: { name: 'asc' },
      include: listInclude,
    });
  }
}
