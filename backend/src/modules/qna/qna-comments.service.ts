import { BaseService } from '@/services/base.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/utils/app-error';

import type { CommentView, CreateCommentDto } from './qna-comments.dto';
import { QnaCommentsRepository, type CommentWithAuthor } from './qna-comments.repository';
import type { Actor } from './qna-comments.types';

// Business logic for the qna-comments module. Controllers call into this layer only.
export class QnaCommentsService extends BaseService {
  constructor(protected readonly repository: QnaCommentsRepository = new QnaCommentsRepository()) {
    super();
  }

  /**
   * Comments belong to exactly one of a question or an answer (Stack-Overflow-style clarifying
   * remark — see schema.prisma's QnaComment doc comment). Any authenticated user who can access
   * the parent question may comment.
   */
  async create(dto: CreateCommentDto, actor: Actor): Promise<CommentView> {
    const { questionId, answerId, content } = dto;
    if ((questionId && answerId) || (!questionId && !answerId)) {
      throw new BadRequestError('Provide exactly one of questionId or answerId.');
    }

    const targetQuestionId = answerId ? await this.resolveQuestionIdFromAnswer(answerId) : (questionId as string);
    await this.assertQuestionAccessible(targetQuestionId, actor);

    const created = await this.repository.create({
      ...(questionId ? { question: { connect: { id: questionId } } } : {}),
      ...(answerId ? { answer: { connect: { id: answerId } } } : {}),
      author: { connect: { id: actor.id } },
      content,
    });

    return this.toCommentView(created);
  }

  /** Comment author OR TRAINER/SUPER_ADMIN only — no accessibility re-check on delete (Prompt 7 § PART A). */
  async remove(id: string, actor: Actor): Promise<void> {
    const comment = await this.repository.findById(id);
    if (!comment) throw new NotFoundError('Comment not found.');

    const isOwner = comment.authorId === actor.id;
    const isStaff = actor.role === 'TRAINER' || actor.role === 'SUPER_ADMIN';
    if (!isOwner && !isStaff) {
      throw new ForbiddenError("You don't have permission to delete this comment.");
    }

    await this.repository.delete(id);
  }

  /** Resolves a comment's target question id from its parent answer — 404s if missing/soft-deleted. */
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

  private toCommentView(comment: CommentWithAuthor): CommentView {
    return {
      id: comment.id,
      questionId: comment.questionId,
      answerId: comment.answerId,
      content: comment.content,
      author: {
        id: comment.author.id,
        firstName: comment.author.firstName,
        lastName: comment.author.lastName,
      },
      createdAt: comment.createdAt,
    };
  }
}
