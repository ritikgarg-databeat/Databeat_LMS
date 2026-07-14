import type { Prisma } from '@prisma/client';

import { BaseRepository } from '@/repositories/base.repository';

import type { QuestionListFilters, QuestionSortField, SortOrder } from './questions.types';

function buildWhere(filters: QuestionListFilters): Prisma.QuestionWhereInput {
  const where: Prisma.QuestionWhereInput = { deletedAt: null };

  if (filters.category) where.category = filters.category;
  if (filters.difficulty) where.difficulty = filters.difficulty;
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.search) where.title = { contains: filters.search, mode: 'insensitive' };

  return where;
}

const summaryInclude = {
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.QuestionInclude;

// Kept lightweight for the list view (Prompt 6 § GET /questions) — `_count.assessmentQuestions`
// lets the UI warn before deleting a question that's still referenced, but the full `options`
// array is only fetched for the detail view.
const listInclude = {
  ...summaryInclude,
  _count: { select: { assessmentQuestions: true } },
} satisfies Prisma.QuestionInclude;

const detailInclude = {
  ...listInclude,
  options: { orderBy: { order: 'asc' } },
} satisfies Prisma.QuestionInclude;

export type QuestionListItem = Prisma.QuestionGetPayload<{ include: typeof listInclude }>;
export type QuestionDetail = Prisma.QuestionGetPayload<{ include: typeof detailInclude }>;

interface QuestionOptionData {
  text: string;
  isCorrect: boolean;
}

// Data-access layer for the questions module. Only this class may query Prisma directly
// (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly.
export class QuestionsRepository extends BaseRepository {
  async findMany(
    filters: QuestionListFilters,
    skip: number,
    take: number,
    sortBy: QuestionSortField = 'createdAt',
    sortOrder: SortOrder = 'desc',
  ) {
    const where = buildWhere(filters);
    const [items, total] = await Promise.all([
      this.db.question.findMany({ where, skip, take, orderBy: { [sortBy]: sortOrder }, include: listInclude }),
      this.db.question.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string) {
    return this.db.question.findFirst({ where: { id, deletedAt: null } });
  }

  findDetailById(id: string) {
    return this.db.question.findFirst({ where: { id, deletedAt: null }, include: detailInclude });
  }

  /**
   * Raw lookup — NOT filtered by `deletedAt`/`status` — consumed directly by the assessments
   * module (built in parallel, Prompt 6) to read a bank question's current content when
   * snapshotting it into an AssessmentQuestion. Keep this name/signature/return shape stable.
   */
  findByIdWithOptions(id: string) {
    return this.db.question.findUnique({
      where: { id },
      include: { options: { orderBy: { order: 'asc' } } },
    });
  }

  /** Creates the Question row and its QuestionOption rows (if any) in a single transaction. */
  async createWithOptions(data: Prisma.QuestionCreateInput, options?: QuestionOptionData[]) {
    return this.db.$transaction(async (tx) => {
      const created = await tx.question.create({ data });

      if (options && options.length > 0) {
        await tx.questionOption.createMany({
          data: options.map((option, index) => ({
            questionId: created.id,
            text: option.text,
            isCorrect: option.isCorrect,
            order: index,
          })),
        });
      }

      return tx.question.findUniqueOrThrow({ where: { id: created.id }, include: detailInclude });
    });
  }

  /**
   * Updates the Question row and, if `options` is provided, REPLACES the full set of
   * QuestionOption rows (delete-then-recreate rather than diffing individual options) — all in
   * a single transaction. `options: undefined` leaves the existing options untouched.
   */
  async updateWithOptions(id: string, data: Prisma.QuestionUpdateInput, options?: QuestionOptionData[]) {
    return this.db.$transaction(async (tx) => {
      await tx.question.update({ where: { id }, data });

      if (options !== undefined) {
        await tx.questionOption.deleteMany({ where: { questionId: id } });
        if (options.length > 0) {
          await tx.questionOption.createMany({
            data: options.map((option, index) => ({
              questionId: id,
              text: option.text,
              isCorrect: option.isCorrect,
              order: index,
            })),
          });
        }
      }

      return tx.question.findUniqueOrThrow({ where: { id }, include: detailInclude });
    });
  }

  update(id: string, data: Prisma.QuestionUpdateInput) {
    return this.db.question.update({ where: { id }, data, include: listInclude });
  }

  softDelete(id: string) {
    return this.db.question.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
