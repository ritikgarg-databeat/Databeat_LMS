import { notificationsService } from '@/modules/notifications';
import { auditLogService } from '@/services/audit-log.service';
import { BaseService } from '@/services/base.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/utils/app-error';
import { logger } from '@/utils/logger';

import type { CreateAnswerDto, UpdateAnswerDto, VerifyAnswerDto } from './qna-answers.dto';
import { QnaAnswersRepository, type QnaAnswerWithAuthor } from './qna-answers.repository';
import type { Actor } from './qna-answers.types';

const CLOSED_QUESTION_MESSAGE = 'This question is closed and no longer accepting answers.';

// Business logic for the qna-answers module. Controllers call into this layer only.
export class QnaAnswersService extends BaseService {
  constructor(protected readonly repository: QnaAnswersRepository = new QnaAnswersRepository()) {
    super();
  }

  /**
   * Any authenticated user who can access the parent question (per the visibility rule) may
   * answer it, as long as it isn't CLOSED (SOLVED questions may still receive new answers).
   * Missing/soft-deleted question is a 404 for every role; existing-but-out-of-visibility is a
   * 403 — this module's deliberate convention (see qna/README.md), matching the questions/
   * comments/votes slices.
   */
  async create(dto: CreateAnswerDto, actor: Actor, ipAddress?: string | null): Promise<QnaAnswerWithAuthor> {
    const question = await this.repository.findQuestionForAnswering(dto.questionId);

    if (!question || question.deletedAt !== null) {
      throw new NotFoundError('Question not found.');
    }

    const accessible = await this.repository.isQuestionAccessibleToUser(dto.questionId, actor.id, actor.role);
    if (!accessible) throw new ForbiddenError("You don't have permission to answer this question.");

    if (question.status === 'CLOSED') throw new BadRequestError(CLOSED_QUESTION_MESSAGE);

    const created = await this.repository.create({
      question: { connect: { id: dto.questionId } },
      author: { connect: { id: actor.id } },
      content: dto.content,
    });

    await auditLogService.record({
      action: 'QNA_ANSWER_CREATED',
      actorId: actor.id,
      ipAddress,
      metadata: { answerId: created.id, questionId: dto.questionId },
    });

    // Best-effort: a transient notification failure must never fail the answer submission
    // itself (mirrors calendar.service.ts#notifyAssigned / assessments.service.ts's own
    // ASSESSMENT_ASSIGNED notify call).
    if (question.authorId !== actor.id) {
      await notificationsService
        .notify({
          userId: question.authorId,
          type: 'QNA_ANSWER_POSTED',
          title: 'New answer to your question',
          message: `${created.author.firstName} ${created.author.lastName} posted an answer to your question.`,
          relatedEntityType: 'qna_question',
          relatedEntityId: dto.questionId,
        })
        .catch((error: unknown) => {
          logger.error('Failed to send qna-answer-posted notification', {
            error,
            questionId: dto.questionId,
            answerId: created.id,
          });
        });
    }

    return created;
  }

  /** The answer's own author, or any TRAINER/SUPER_ADMIN, may edit its content. */
  async update(
    id: string,
    dto: UpdateAnswerDto,
    actor: Actor,
    ipAddress?: string | null,
  ): Promise<QnaAnswerWithAuthor> {
    const answer = await this.repository.findById(id);
    if (!answer) throw new NotFoundError('Answer not found.');

    const isOwner = answer.authorId === actor.id;
    const isStaff = actor.role === 'TRAINER' || actor.role === 'SUPER_ADMIN';
    if (!isOwner && !isStaff) throw new ForbiddenError("You don't have permission to edit this answer.");

    const updated = await this.repository.update(id, { content: dto.content });

    await auditLogService.record({
      action: 'QNA_ANSWER_UPDATED',
      actorId: actor.id,
      ipAddress,
      metadata: { answerId: id },
    });

    return updated;
  }

  /** The answer's own author, or any TRAINER/SUPER_ADMIN, may soft-delete it. */
  async remove(id: string, actor: Actor, ipAddress?: string | null): Promise<void> {
    const answer = await this.repository.findById(id);
    if (!answer) throw new NotFoundError('Answer not found.');

    const isOwner = answer.authorId === actor.id;
    const isStaff = actor.role === 'TRAINER' || actor.role === 'SUPER_ADMIN';
    if (!isOwner && !isStaff) throw new ForbiddenError("You don't have permission to delete this answer.");

    await this.repository.softDelete(id);

    await auditLogService.record({
      action: 'QNA_ANSWER_DELETED',
      actorId: actor.id,
      ipAddress,
      metadata: { answerId: id },
    });
  }

  /** TRAINER/SUPER_ADMIN only — even the question's own (trainee) author may not pin. */
  async pin(id: string, isPinned: boolean, actor: Actor, ipAddress?: string | null): Promise<QnaAnswerWithAuthor> {
    if (actor.role !== 'TRAINER' && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError("You don't have permission to pin answers.");
    }

    const answer = await this.repository.findById(id);
    if (!answer) throw new NotFoundError('Answer not found.');

    const updated = await this.repository.pin(id, isPinned);

    await auditLogService.record({
      action: 'QNA_ANSWER_PINNED',
      actorId: actor.id,
      ipAddress,
      metadata: { answerId: id, isPinned },
    });

    return updated;
  }

  /**
   * TRAINER/SUPER_ADMIN only. `questionId` is a plain string handed in by the controller (the
   * orchestrating qna.routes.ts mounts this under `/qna/questions/:id/verify-answer`, so this
   * service never needs to know the URL shape). Marks the target answer verified, promotes the
   * parent question to SOLVED unless it's already CLOSED (CLOSED always wins), and best-effort
   * notifies the answer's author.
   */
  async verify(
    questionId: string,
    dto: VerifyAnswerDto,
    actor: Actor,
    ipAddress?: string | null,
  ): Promise<QnaAnswerWithAuthor> {
    if (actor.role !== 'TRAINER' && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError("You don't have permission to verify answers.");
    }

    const question = await this.repository.findQuestionForAnswering(questionId);
    if (!question || question.deletedAt !== null) throw new NotFoundError('Question not found.');

    const answer = await this.repository.findById(dto.answerId);
    if (!answer || answer.questionId !== questionId) throw new NotFoundError('Answer not found.');

    const verified = await this.repository.verify(dto.answerId, actor.id);
    await this.repository.markSolvedUnlessClosed(questionId);

    await auditLogService.record({
      action: 'QNA_ANSWER_VERIFIED',
      actorId: actor.id,
      ipAddress,
      metadata: { answerId: dto.answerId, questionId },
    });

    // Guard against a trainer verifying their own posted answer even though trainees (the usual
    // authors) can never reach this endpoint themselves.
    if (verified.authorId !== actor.id) {
      await notificationsService
        .notify({
          userId: verified.authorId,
          type: 'QNA_ANSWER_VERIFIED',
          title: 'Your answer was verified',
          message: 'A trainer verified your answer as the accepted solution.',
          relatedEntityType: 'qna_question',
          relatedEntityId: questionId,
        })
        .catch((error: unknown) => {
          logger.error('Failed to send qna-answer-verified notification', {
            error,
            questionId,
            answerId: dto.answerId,
          });
        });
    }

    return verified;
  }
}

export const qnaAnswersService = new QnaAnswersService();
