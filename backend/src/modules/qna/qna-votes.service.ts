import { BaseService } from '@/services/base.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/utils/app-error';

import type { ToggleVoteDto, VoteToggleResult } from './qna-votes.dto';
import { QnaVotesRepository } from './qna-votes.repository';
import type { Actor, VoteTarget } from './qna-votes.types';

// Business logic for the qna-votes module. Controllers call into this layer only.
export class QnaVotesService extends BaseService {
  constructor(protected readonly repository: QnaVotesRepository = new QnaVotesRepository()) {
    super();
  }

  /**
   * "Like/upvote" (Prompt 7 § ANSWERS) implemented as a toggle, not create-only: voting again
   * removes the existing vote. Exactly one of `questionId`/`answerId` must be set — same XOR
   * rule as comments. Any authenticated user who can access the parent question may vote.
   */
  async toggle(dto: ToggleVoteDto, actor: Actor): Promise<VoteToggleResult> {
    const { questionId, answerId } = dto;
    if ((questionId && answerId) || (!questionId && !answerId)) {
      throw new BadRequestError('Provide exactly one of questionId or answerId.');
    }

    const targetQuestionId = answerId ? await this.resolveQuestionIdFromAnswer(answerId) : (questionId as string);
    await this.assertQuestionAccessible(targetQuestionId, actor);

    const target: VoteTarget = questionId ? { questionId } : { answerId: answerId as string };
    return this.repository.toggle(actor.id, target);
  }

  /** Resolves a vote's target question id from its parent answer — 404s if missing/soft-deleted. */
  private async resolveQuestionIdFromAnswer(answerId: string): Promise<string> {
    const answer = await this.repository.findAnswerById(answerId);
    if (!answer || answer.deletedAt !== null) throw new NotFoundError('Answer not found.');
    return answer.questionId;
  }

  /**
   * Confirms `questionId` both exists (not soft-deleted) and is visible to `actor` (Prompt 7 §
   * GROUP VISIBILITY) — 404 for "not found or deleted" (a deleted question genuinely no longer
   * exists), 403 for "exists but you can't see it".
   */
  private async assertQuestionAccessible(questionId: string, actor: Actor): Promise<void> {
    const question = await this.repository.findQuestionById(questionId);
    if (!question || question.deletedAt !== null) throw new NotFoundError('Question not found.');

    const accessible = await this.repository.isQuestionAccessibleToUser(questionId, actor.id, actor.role);
    if (!accessible) throw new ForbiddenError("You don't have permission to access this question.");
  }
}
