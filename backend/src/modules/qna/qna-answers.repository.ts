import type { Prisma, Role } from '@prisma/client';

import { activeGroupMembershipWhere } from '@/policies/group-access.policy';
import { qnaQuestionAccessScope } from '@/policies/qna-access.policy';
import { BaseRepository } from '@/repositories/base.repository';

const authorSelect = {
  id: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.UserSelect;

const answerInclude = {
  author: { select: authorSelect },
  verifiedBy: { select: authorSelect },
} satisfies Prisma.QnaAnswerInclude;

export type QnaAnswerWithAuthor = Prisma.QnaAnswerGetPayload<{ include: typeof answerInclude }>;

const answerableQuestionSelect = {
  id: true,
  authorId: true,
  status: true,
  deletedAt: true,
} satisfies Prisma.QnaQuestionSelect;

/** Just enough of the parent question to decide answerability — see `findQuestionForAnswering`. */
export type AnswerableQuestion = Prisma.QnaQuestionGetPayload<{ select: typeof answerableQuestionSelect }>;

/**
 * Data-access layer for the qna-answers module. Only this class may query Prisma directly
 * (see ARCHITECTURE.md §3.1) — the service must go through it, never Prisma directly.
 *
 * This module owns QnaAnswer exclusively. It also runs a handful of read-only queries directly
 * against QnaQuestion/GroupMember/User to decide whether an answer may be created/verified
 * against a given question — a self-contained, feature-local duplicate of the qna-questions
 * module's own accessibility rule (that module is being built in parallel, so its repository
 * isn't a stable import target yet), NOT a shared cross-module import. This mirrors the
 * codebase's established "feature-local duplication over premature cross-module coupling"
 * convention — see lessons.repository.ts#isAccessibleToUser and
 * assessment-attempts.repository.ts#isAssessmentAccessibleToUser (whose own doc-comment explains
 * the same tradeoff) for precedent.
 */
export class QnaAnswersRepository extends BaseRepository {
  findById(id: string): Promise<QnaAnswerWithAuthor | null> {
    return this.db.qnaAnswer.findFirst({ where: { id, deletedAt: null }, include: answerInclude });
  }

  create(data: Prisma.QnaAnswerCreateInput): Promise<QnaAnswerWithAuthor> {
    return this.db.qnaAnswer.create({ data, include: answerInclude });
  }

  update(id: string, data: Prisma.QnaAnswerUpdateInput): Promise<QnaAnswerWithAuthor> {
    return this.db.qnaAnswer.update({ where: { id }, data, include: answerInclude });
  }

  softDelete(id: string) {
    return this.db.qnaAnswer.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  pin(id: string, isPinned: boolean): Promise<QnaAnswerWithAuthor> {
    return this.db.qnaAnswer.update({ where: { id }, data: { isPinned }, include: answerInclude });
  }

  verify(id: string, verifiedById: string): Promise<QnaAnswerWithAuthor> {
    return this.db.qnaAnswer.update({
      where: { id },
      data: { isVerified: true, verifiedById, verifiedAt: new Date() },
      include: answerInclude,
    });
  }

  /**
   * Just enough of the parent question to decide answerability (existence, soft-delete, author
   * id for the "new answer" notification, status for the CLOSED check) — not the full question
   * detail view, which belongs to the qna-questions module.
   */
  findQuestionForAnswering(questionId: string): Promise<AnswerableQuestion | null> {
    return this.db.qnaQuestion.findUnique({ where: { id: questionId }, select: answerableQuestionSelect });
  }

  /**
   * Self-contained copy of the qna-questions module's GROUP/DEPARTMENT/ORGANIZATION visibility
   * rule (Prompt 7 § GROUP VISIBILITY) — see this class's doc-comment for why it's duplicated
   * rather than imported. TRAINER/SUPER_ADMIN always pass; ORGANIZATION is open to everyone;
   * GROUP requires a matching GroupMember row; DEPARTMENT requires the user's own
   * `User.departmentId` to match. A missing or soft-deleted question is never accessible.
   */
  async isQuestionAccessibleToUser(questionId: string, userId: string, role: Role): Promise<boolean> {
    if (role === 'SUPER_ADMIN') return true;
    if (role === 'TRAINER') {
      const scoped = await this.db.qnaQuestion.findFirst({
        where: { id: questionId, ...qnaQuestionAccessScope(userId, role) },
        select: { id: true },
      });
      return scoped !== null;
    }

    const question = await this.db.qnaQuestion.findUnique({
      where: { id: questionId },
      select: { visibility: true, groupId: true, departmentId: true, deletedAt: true },
    });
    if (!question || question.deletedAt !== null) return false;

    if (question.visibility === 'ORGANIZATION') return true;

    if (question.visibility === 'GROUP') {
      if (!question.groupId) return false;
      const membership = await this.db.groupMember.findFirst({
        where: activeGroupMembershipWhere(userId, { id: question.groupId }),
        select: { id: true },
      });
      return membership !== null;
    }

    // DEPARTMENT
    if (!question.departmentId) return false;
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
    return user?.departmentId === question.departmentId;
  }

  /** A CLOSED question keeps its status even once an answer is verified — CLOSED always wins. */
  async markSolvedUnlessClosed(questionId: string): Promise<void> {
    await this.db.qnaQuestion.updateMany({
      where: { id: questionId, status: { not: 'CLOSED' } },
      data: { status: 'SOLVED' },
    });
  }
}
