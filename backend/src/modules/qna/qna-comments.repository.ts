import type { Prisma, Role } from '@prisma/client';

import { activeGroupMembershipWhere } from '@/policies/group-access.policy';
import { BaseRepository } from '@/repositories/base.repository';

const commentWithAuthorInclude = {
  author: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.QnaCommentInclude;

export type CommentWithAuthor = Prisma.QnaCommentGetPayload<{ include: typeof commentWithAuthorInclude }>;

// Data-access layer for the qna-comments module. Only this class may query Prisma directly
// (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly. This module
// works directly against QnaQuestion/QnaAnswer/GroupMember/User for its own accessibility
// check — deliberately not importing from the qna-questions/qna-answers modules (built in
// parallel right now; feature-local duplication over premature cross-module coupling, mirroring
// the resources/assessment-attempts modules' precedent).
export class QnaCommentsRepository extends BaseRepository {
  create(data: Prisma.QnaCommentCreateInput): Promise<CommentWithAuthor> {
    return this.db.qnaComment.create({ data, include: commentWithAuthorInclude });
  }

  findById(id: string) {
    return this.db.qnaComment.findUnique({ where: { id } });
  }

  delete(id: string) {
    return this.db.qnaComment.delete({ where: { id } });
  }

  /** Feature-local existence check — the qna-questions module owns QnaQuestion but isn't a dependency here. */
  findQuestionById(questionId: string) {
    return this.db.qnaQuestion.findUnique({ where: { id: questionId } });
  }

  /** Feature-local existence check — the qna-answers module owns QnaAnswer but isn't a dependency here. */
  findAnswerById(answerId: string) {
    return this.db.qnaAnswer.findUnique({ where: { id: answerId } });
  }

  /**
   * Self-contained copy of the Q&A group-visibility rule (Prompt 7 § GROUP VISIBILITY),
   * duplicated verbatim in qna-votes.repository.ts (feature-local duplication, no cross-module
   * import — this codebase's established convention, e.g. assessment-attempts/resources each
   * keep their own copy of the same lesson-accessibility rule rather than sharing it). TRAINER
   * and SUPER_ADMIN always pass; ORGANIZATION-visibility questions are open to everyone;
   * GROUP-visibility requires a GroupMember row for the question's `groupId`; DEPARTMENT-
   * visibility requires the caller's own `departmentId` to match the question's. A missing or
   * soft-deleted question is never accessible.
   */
  async isQuestionAccessibleToUser(questionId: string, userId: string, role: Role): Promise<boolean> {
    if (role === 'TRAINER' || role === 'SUPER_ADMIN') return true;

    const question = await this.db.qnaQuestion.findUnique({ where: { id: questionId } });
    if (!question || question.deletedAt !== null) return false;

    if (question.visibility === 'ORGANIZATION') return true;

    if (question.visibility === 'GROUP') {
      if (!question.groupId) return false;
      const membership = await this.db.groupMember.findFirst({
        where: activeGroupMembershipWhere(userId, { id: question.groupId }),
      });
      return membership !== null;
    }

    // DEPARTMENT
    if (!question.departmentId) return false;
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
    return user?.departmentId === question.departmentId;
  }
}
