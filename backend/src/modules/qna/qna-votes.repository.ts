import { Prisma, type Role } from '@prisma/client';

import { activeGroupMembershipWhere } from '@/policies/group-access.policy';
import { qnaQuestionAccessScope } from '@/policies/qna-access.policy';
import { BaseRepository } from '@/repositories/base.repository';

import type { VoteTarget, VoteToggleOutcome } from './qna-votes.types';

function matchWhere(userId: string, target: VoteTarget): Prisma.QnaVoteWhereInput {
  return target.questionId
    ? { userId, questionId: target.questionId }
    : { userId, answerId: target.answerId };
}

function countWhere(target: VoteTarget): Prisma.QnaVoteWhereInput {
  return target.questionId ? { questionId: target.questionId } : { answerId: target.answerId };
}

// Data-access layer for the qna-votes module. Only this class may query Prisma directly (see
// ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly. This module works
// directly against QnaQuestion/QnaAnswer/GroupMember/User for its own accessibility check —
// deliberately not importing from the qna-questions/qna-answers modules (built in parallel right
// now; feature-local duplication over premature cross-module coupling, mirroring the
// resources/assessment-attempts modules' precedent).
export class QnaVotesRepository extends BaseRepository {
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
   * duplicated verbatim in qna-comments.repository.ts (feature-local duplication, no
   * cross-module import — this codebase's established convention, e.g. assessment-attempts/
   * resources each keep their own copy of the same lesson-accessibility rule rather than
   * sharing it). TRAINER and SUPER_ADMIN always pass; ORGANIZATION-visibility questions are open
   * to everyone; GROUP-visibility requires a GroupMember row for the question's `groupId`;
   * DEPARTMENT-visibility requires the caller's own `departmentId` to match the question's. A
   * missing or soft-deleted question is never accessible.
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

  /**
   * "Like/upvote" toggle (Prompt 7 § ANSWERS / VOTE SEMANTICS): read-then-write wrapped in a
   * single transaction to minimize (not fully eliminate — no advisory locks used elsewhere in
   * this codebase either) the race window between the existence check and the create/delete. If
   * a concurrent request still wins the race on the create branch, the DB's hand-added partial
   * unique index (see schema.prisma's QnaVote doc comment) raises P2002, which is caught here
   * and treated as "already voted" rather than surfaced as a 500.
   */
  async toggle(userId: string, target: VoteTarget): Promise<VoteToggleOutcome> {
    try {
      return await this.db.$transaction(async (tx) => {
        const existing = await tx.qnaVote.findFirst({ where: matchWhere(userId, target) });

        if (existing) {
          await tx.qnaVote.delete({ where: { id: existing.id } });
          const voteCount = await tx.qnaVote.count({ where: countWhere(target) });
          return { voted: false, voteCount };
        }

        await tx.qnaVote.create({
          data: {
            user: { connect: { id: userId } },
            ...(target.questionId ? { question: { connect: { id: target.questionId } } } : {}),
            ...(target.answerId ? { answer: { connect: { id: target.answerId } } } : {}),
          },
        });
        const voteCount = await tx.qnaVote.count({ where: countWhere(target) });
        return { voted: true, voteCount };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Another concurrent request created the same vote first — treat it as "already voted"
        // rather than a 500 (Prompt 7 § VOTE SEMANTICS).
        const voteCount = await this.db.qnaVote.count({ where: countWhere(target) });
        return { voted: true, voteCount };
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        // The delete-branch mirror of the race above: both concurrent requests read the same
        // existing vote, the loser's delete finds the row already gone — "already un-voted".
        const voteCount = await this.db.qnaVote.count({ where: countWhere(target) });
        return { voted: false, voteCount };
      }
      throw error;
    }
  }
}
