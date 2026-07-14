import type { Prisma, Role } from '@prisma/client';

import { BaseRepository } from '@/repositories/base.repository';

const questionSearchInclude = {
  author: { select: { firstName: true, lastName: true } },
  tags: { include: { tag: true } },
  // Filtered like the questions-list DTO's answersCount — an unfiltered count would resurrect
  // soft-deleted answers in search results only.
  _count: { select: { answers: { where: { deletedAt: null } } } },
} satisfies Prisma.QnaQuestionInclude;

export type QnaQuestionSearchRow = Prisma.QnaQuestionGetPayload<{ include: typeof questionSearchInclude }>;

const tagSearchInclude = {
  // QnaQuestionTag rows survive question soft-delete (softDelete never unlinks tags), so the
  // count must look through to the question's own deletedAt — mirrors qna-tags.repository.ts.
  _count: { select: { questions: { where: { question: { deletedAt: null } } } } },
} satisfies Prisma.QnaTagInclude;

export type QnaTagSearchRow = Prisma.QnaTagGetPayload<{ include: typeof tagSearchInclude }>;

// Data-access layer for the qna-search module. Only this class may query Prisma directly
// (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly.
export class QnaSearchRepository extends BaseRepository {
  /**
   * Non-deleted questions whose title or description matches `q` (case-insensitive), scoped by
   * the same Prompt 7 § GROUP VISIBILITY rule as `qna-questions.repository.ts#findManyForActor`
   * (feature-local duplication, not a shared import — see this module's README) — search must
   * never surface a GROUP/DEPARTMENT question's title/description to someone who couldn't open
   * it via `GET /qna/questions/:id` anyway.
   */
  async findQuestions(q: string, take: number, actor: { id: string; role: Role }): Promise<QnaQuestionSearchRow[]> {
    const where: Prisma.QnaQuestionWhereInput = {
      deletedAt: null,
      OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }],
    };

    if (actor.role !== 'TRAINER' && actor.role !== 'SUPER_ADMIN') {
      const [user, memberships] = await Promise.all([
        this.db.user.findUnique({ where: { id: actor.id }, select: { departmentId: true } }),
        this.db.groupMember.findMany({ where: { userId: actor.id }, select: { groupId: true } }),
      ]);
      const groupIds = memberships.map((membership) => membership.groupId);

      const accessOr: Prisma.QnaQuestionWhereInput[] = [{ visibility: 'ORGANIZATION' }];
      if (user?.departmentId) accessOr.push({ visibility: 'DEPARTMENT', departmentId: user.departmentId });
      if (groupIds.length > 0) accessOr.push({ visibility: 'GROUP', groupId: { in: groupIds } });

      where.AND = [{ OR: accessOr }];
    }

    return this.db.qnaQuestion.findMany({
      where,
      include: questionSearchInclude,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  findTags(q: string, take: number): Promise<QnaTagSearchRow[]> {
    return this.db.qnaTag.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      include: tagSearchInclude,
      take,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Published, non-deleted courses only; non-staff are additionally restricted to courses
   * assigned to one of their groups — the same access rule `CoursesRepository` enforces
   * (Prompt 5 § SECURITY), so search never surfaces a course title the caller couldn't open.
   */
  findCourses(q: string, take: number, actor: { id: string; role: Role }) {
    const where: Prisma.CourseWhereInput = {
      status: 'PUBLISHED',
      deletedAt: null,
      title: { contains: q, mode: 'insensitive' },
    };
    if (actor.role !== 'TRAINER' && actor.role !== 'SUPER_ADMIN') {
      where.groupAssignments = { some: { group: { members: { some: { userId: actor.id } } } } };
    }
    return this.db.course.findMany({ where, select: { id: true, title: true }, take, orderBy: { title: 'asc' } });
  }

  /**
   * Mirrors the full lesson-accessibility rule (`LessonsRepository#isAccessibleToUser`, Prompt 5):
   * the lesson AND its module must be published, its course PUBLISHED and non-deleted, and —
   * for non-staff — the course assigned to one of the caller's groups. `isPublished` alone
   * would leak titles of lessons inside DRAFT courses or unpublished modules.
   */
  findLessons(q: string, take: number, actor: { id: string; role: Role }) {
    const where: Prisma.LessonWhereInput = {
      isPublished: true,
      title: { contains: q, mode: 'insensitive' },
      module: {
        isPublished: true,
        course: {
          status: 'PUBLISHED',
          deletedAt: null,
          ...(actor.role !== 'TRAINER' && actor.role !== 'SUPER_ADMIN'
            ? { groupAssignments: { some: { group: { members: { some: { userId: actor.id } } } } } }
            : {}),
        },
      },
    };
    return this.db.lesson.findMany({ where, select: { id: true, title: true }, take, orderBy: { title: 'asc' } });
  }
}
