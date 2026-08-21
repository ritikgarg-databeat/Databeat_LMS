import type { Prisma, Role } from '@prisma/client';

import { activeGroupMembershipWhere } from '@/policies/group-access.policy';
import { BaseRepository } from '@/repositories/base.repository';

import type { QnaQuestionListFilters, QnaQuestionSortField } from './qna-questions.types';

const listInclude = {
  author: { select: { id: true, firstName: true, lastName: true } },
  tags: { include: { tag: { select: { name: true } } } },
  // Minimal projection (not `_count`) because we need both "how many" and "does any qualify as
  // verified" out of the same relation — Prisma's `_count.select` can only apply one filter per
  // relation, so a single filtered fetch of `isVerified` flags covers both `answersCount` and
  // `hasVerifiedAnswer` without a second query.
  answers: { where: { deletedAt: null }, select: { isVerified: true } },
  _count: { select: { votes: true } },
} satisfies Prisma.QnaQuestionInclude;

const detailInclude = {
  author: { select: { id: true, firstName: true, lastName: true } },
  course: { select: { id: true, title: true } },
  module: { select: { id: true, title: true } },
  lesson: { select: { id: true, title: true } },
  tags: { include: { tag: { select: { name: true } } } },
  attachments: { orderBy: { createdAt: 'asc' } },
  // Full voter-id list (not `_count`) so the service can compute both `voteCount` and `myVote`
  // (whether the requesting user is among them) from one fetch — acceptable volume for an LMS
  // Q&A thread's votes, unlike e.g. a public social feed.
  votes: { select: { userId: true } },
  comments: {
    where: { answerId: null },
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'asc' },
  },
  answers: {
    where: { deletedAt: null },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
      verifiedBy: { select: { id: true, firstName: true, lastName: true } },
      votes: { select: { userId: true } },
      comments: {
        include: { author: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: [{ isPinned: 'desc' }, { isVerified: 'desc' }, { createdAt: 'asc' }],
  },
} satisfies Prisma.QnaQuestionInclude;

export type QnaQuestionListItem = Prisma.QnaQuestionGetPayload<{ include: typeof listInclude }>;
export type QnaQuestionDetail = Prisma.QnaQuestionGetPayload<{ include: typeof detailInclude }>;

function buildFilterWhere(filters: QnaQuestionListFilters): Prisma.QnaQuestionWhereInput {
  const where: Prisma.QnaQuestionWhereInput = { deletedAt: null };

  if (filters.status) where.status = filters.status;
  if (filters.courseId) where.courseId = filters.courseId;
  if (filters.tag) where.tags = { some: { tag: { name: filters.tag } } };
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.unanswered) where.answers = { none: { deletedAt: null } };
  if (filters.pendingVerification) {
    // Needs two conditions on the same `answers` relation ("has at least one live answer" AND
    // "none of them verified"), which a single `where.answers` key can't express — hence AND.
    where.AND = [
      { answers: { some: { deletedAt: null } } },
      { answers: { none: { deletedAt: null, isVerified: true } } },
    ];
  }

  return where;
}

// Data-access layer for the qna-questions module. Only this class may query Prisma directly
// (see ARCHITECTURE.md §3.1) — the service must go through it, never Prisma directly. Also
// queries directly against QnaAnswer/QnaComment/QnaVote/QnaAttachment/QnaTag/QnaQuestionTag for
// the question detail view and tag management — Prisma doesn't respect the module file
// boundaries the four parallel qna-* agents work under, so this is expected (see this module's
// build-prompt note on cross-model detail queries).
export class QnaQuestionsRepository extends BaseRepository {
  /**
   * Role/visibility-scoped list. Trainer/Super-Admin see every non-deleted question; any other
   * role only sees ORGANIZATION questions, DEPARTMENT questions matching their own department,
   * and GROUP questions for groups they belong to (Prompt 7 § GROUP VISIBILITY).
   */
  async findManyForActor(
    filters: QnaQuestionListFilters,
    actor: { id: string; role: Role },
    skip: number,
    take: number,
    sortBy: QnaQuestionSortField,
  ): Promise<{ items: QnaQuestionListItem[]; total: number }> {
    const where = await this.buildActorScopedWhere(filters, actor);

    const [items, total] = await Promise.all([
      this.db.qnaQuestion.findMany({
        where,
        skip,
        take,
        // `votes` needs the createdAt tie-breaker: most questions tie at 0 votes, and without
        // a total order Postgres may shuffle ties between a client's page-1 and page-2 fetches
        // (viewCount increments rewrite tuples), duplicating/dropping rows across pages.
        orderBy:
          sortBy === 'votes'
            ? ([{ votes: { _count: 'desc' } }, { createdAt: 'desc' }] as const)
            : ({ createdAt: 'desc' } as const),
        include: listInclude,
      }),
      this.db.qnaQuestion.count({ where }),
    ]);
    return { items, total };
  }

  private async buildActorScopedWhere(
    filters: QnaQuestionListFilters,
    actor: { id: string; role: Role },
  ): Promise<Prisma.QnaQuestionWhereInput> {
    const where = buildFilterWhere(filters);
    if (filters.mine) where.authorId = actor.id;
    if (actor.role === 'TRAINER' || actor.role === 'SUPER_ADMIN') return where;

    const [user, memberships] = await Promise.all([
      this.db.user.findUnique({ where: { id: actor.id }, select: { departmentId: true } }),
      this.db.groupMember.findMany({
        where: activeGroupMembershipWhere(actor.id),
        select: { groupId: true },
      }),
    ]);
    const groupIds = memberships.map((membership) => membership.groupId);

    // Authors always see their own questions (even after losing GROUP/DEPARTMENT access —
    // e.g. removed from the group), so "My Questions" never silently hides the user's own
    // posts. This author bypass exists ONLY in the questions slice (view access); the
    // answers/comments/votes slices deliberately keep the plain visibility rule — losing
    // access removes interaction rights, not visibility of your own content.
    const accessOr: Prisma.QnaQuestionWhereInput[] = [{ visibility: 'ORGANIZATION' }, { authorId: actor.id }];
    if (user?.departmentId) accessOr.push({ visibility: 'DEPARTMENT', departmentId: user.departmentId });
    if (groupIds.length > 0) accessOr.push({ visibility: 'GROUP', groupId: { in: groupIds } });

    // Append, never assign — buildFilterWhere may already have set `where.AND` (the
    // pendingVerification filter), and a plain assignment would silently drop it.
    const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    where.AND = [...existingAnd, { OR: accessOr }];
    return where;
  }

  findById(id: string) {
    return this.db.qnaQuestion.findFirst({ where: { id, deletedAt: null } });
  }

  findDetailById(id: string) {
    return this.db.qnaQuestion.findFirst({ where: { id, deletedAt: null }, include: detailInclude });
  }

  incrementViewCount(id: string) {
    return this.db.qnaQuestion.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  }

  /**
   * Creates the question and its tag associations (upsert-by-name into QnaTag, then link via
   * QnaQuestionTag) inside one transaction, so a question is never left with a partial tag set.
   */
  async createWithTags(data: Prisma.QnaQuestionCreateInput, tagNames: string[]) {
    const uniqueNames = dedupeTagNames(tagNames);

    return this.db.$transaction(async (tx) => {
      const question = await tx.qnaQuestion.create({ data });

      const tagIds: string[] = [];
      for (const name of uniqueNames) {
        const tag = await tx.qnaTag.upsert({ where: { name }, create: { name }, update: {} });
        tagIds.push(tag.id);
      }
      if (tagIds.length > 0) {
        await tx.qnaQuestionTag.createMany({
          data: tagIds.map((tagId) => ({ questionId: question.id, tagId })),
          skipDuplicates: true,
        });
      }

      return question;
    });
  }

  update(id: string, data: Prisma.QnaQuestionUpdateInput) {
    return this.db.qnaQuestion.update({ where: { id }, data });
  }

  /**
   * Full replace (not merge) of a question's tag set — upserts each name into QnaTag, then
   * drops and recreates every QnaQuestionTag row for the question inside one transaction.
   */
  async replaceTags(questionId: string, tagNames: string[]): Promise<void> {
    const uniqueNames = dedupeTagNames(tagNames);

    await this.db.$transaction(async (tx) => {
      const tagIds: string[] = [];
      for (const name of uniqueNames) {
        const tag = await tx.qnaTag.upsert({ where: { name }, create: { name }, update: {} });
        tagIds.push(tag.id);
      }

      await tx.qnaQuestionTag.deleteMany({ where: { questionId } });

      if (tagIds.length > 0) {
        await tx.qnaQuestionTag.createMany({
          data: tagIds.map((tagId) => ({ questionId, tagId })),
          skipDuplicates: true,
        });
      }
    });
  }

  softDelete(id: string) {
    return this.db.qnaQuestion.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  findAttachmentById(id: string) {
    return this.db.qnaAttachment.findUnique({ where: { id } });
  }

  createAttachment(data: Prisma.QnaAttachmentCreateInput) {
    return this.db.qnaAttachment.create({ data });
  }

  deleteAttachment(id: string) {
    return this.db.qnaAttachment.delete({ where: { id } });
  }

  /** Feature-local existence check — the groups module owns Group but isn't a dependency here. */
  findGroupById(groupId: string) {
    return this.db.group.findUnique({ where: { id: groupId }, select: { id: true } });
  }

  /** Feature-local existence check for the optional course/module/lesson linkage on create/update. */
  findCourseById(courseId: string) {
    return this.db.course.findUnique({ where: { id: courseId }, select: { id: true } });
  }

  findModuleById(moduleId: string) {
    return this.db.courseModule.findUnique({ where: { id: moduleId }, select: { id: true } });
  }

  findLessonById(lessonId: string) {
    return this.db.lesson.findUnique({ where: { id: lessonId }, select: { id: true } });
  }

  /** Feature-local existence check — the departments module owns Department but isn't a dependency here. */
  findDepartmentById(departmentId: string) {
    return this.db.department.findUnique({ where: { id: departmentId }, select: { id: true } });
  }

  isGroupMember(groupId: string, userId: string) {
    return this.db.groupMember.findFirst({ where: activeGroupMembershipWhere(userId, { id: groupId }) });
  }

  findUserDepartmentId(userId: string) {
    return this.db.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
  }

  /**
   * Stable, self-contained accessibility contract (Prompt 7 § GROUP VISIBILITY) — the other
   * qna-* modules built in parallel (answers/comments/votes) each keep their OWN copy of this
   * check (this codebase's feature-local-duplication convention, see lessons.repository.ts's
   * `isAccessibleToUser`/resources.repository.ts's `isLessonAccessibleToUser` precedent) but may
   * mirror this method's exact shape as their reference. Keep this name and signature stable.
   *
   * Trainer/Super-Admin always have access, and so does the question's AUTHOR — an author must
   * never lose sight of their own post (e.g. after being removed from the question's group);
   * this author bypass is a deliberate questions-slice-only extension over the plain rule the
   * other slices keep (view access ≠ interaction access). Otherwise: ORGANIZATION questions
   * are accessible to everyone; DEPARTMENT questions require the user's own `departmentId` to
   * match; GROUP questions require a GroupMember row for `{userId, groupId}`. A soft-deleted
   * or genuinely nonexistent question is never accessible.
   */
  async isQuestionAccessibleToUser(questionId: string, userId: string, role: Role): Promise<boolean> {
    if (role === 'TRAINER' || role === 'SUPER_ADMIN') return true;

    const question = await this.db.qnaQuestion.findFirst({
      where: { id: questionId, deletedAt: null },
      select: { visibility: true, groupId: true, departmentId: true, authorId: true },
    });
    if (!question) return false;

    if (question.authorId === userId) return true;

    if (question.visibility === 'ORGANIZATION') return true;

    if (question.visibility === 'DEPARTMENT') {
      const user = await this.db.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
      return question.departmentId !== null && user?.departmentId === question.departmentId;
    }

    // GROUP
    if (!question.groupId) return false;
    const membership = await this.db.groupMember.findFirst({
      where: activeGroupMembershipWhere(userId, { id: question.groupId }),
    });
    return membership !== null;
  }
}

function dedupeTagNames(tagNames: string[]): string[] {
  const trimmed = tagNames.map((name) => name.trim()).filter((name) => name.length > 0);
  return Array.from(new Set(trimmed));
}
