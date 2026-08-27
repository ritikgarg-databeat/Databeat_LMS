import type { Question, QuestionType, Role } from '@prisma/client';

import {
  MAX_QUESTION_CORRECT_ANSWER_LENGTH,
  MAX_QUESTION_OPTIONS,
  MIN_QUESTION_OPTIONS,
} from '@/constants/assessment';
import { auditLogService } from '@/services/audit-log.service';
import { BaseService } from '@/services/base.service';
import type { PaginatedData } from '@/types/common';
import { BadRequestError, ConflictError, NotFoundError } from '@/utils/app-error';
import { buildPaginationMeta } from '@/utils/pagination.util';

import type {
  CreateQuestionDto,
  QuestionOptionInput,
  UpdateQuestionDto,
  UpdateQuestionStatusDto,
} from './questions.dto';
import { QuestionsRepository } from './questions.repository';
import type { QuestionListFilters, QuestionSortField, SortOrder } from './questions.types';

const MCQ_FAMILY_TYPES: QuestionType[] = ['SINGLE_CORRECT_MCQ', 'MULTIPLE_CORRECT', 'TRUE_FALSE'];
const ANSWER_LIST_TYPES: QuestionType[] = ['FILL_IN_THE_BLANK', 'SQL_QUERY'];

interface TypeConditionalFields {
  options?: QuestionOptionInput[];
  correctAnswers?: string[];
  starterCode?: string | null;
  language?: string | null;
}

interface Actor {
  id: string;
  role: Role;
}

// Business logic for the questions module. Controllers call into this layer only.
export class QuestionsService extends BaseService {
  constructor(protected readonly repository: QuestionsRepository = new QuestionsRepository()) {
    super();
  }

  async list(
    filters: QuestionListFilters,
    page: number,
    pageSize: number,
    sortBy: QuestionSortField,
    sortOrder: SortOrder,
    actor: Actor,
  ): Promise<PaginatedData<unknown>> {
    const { items, total } = await this.repository.findMany(
      filters,
      actor,
      (page - 1) * pageSize,
      pageSize,
      sortBy,
      sortOrder,
    );
    return { items, meta: buildPaginationMeta(page, pageSize, total) };
  }

  async getById(id: string, actor: Actor) {
    const question = await this.repository.findDetailByIdForActor(id, actor);
    if (!question) throw new NotFoundError('Question not found.');
    return question;
  }

  async create(dto: CreateQuestionDto, actorId: string, ipAddress?: string | null): Promise<Question> {
    this.assertTypeConditionalFields(dto.type, dto, false);

    const created = await this.repository.createWithOptions(
      {
        title: dto.title,
        type: dto.type,
        category: dto.category,
        difficulty: dto.difficulty,
        explanation: dto.explanation,
        correctAnswers: this.isAnswerListType(dto.type) ? dto.correctAnswers : undefined,
        starterCode: dto.type === 'CODE_SNIPPET' ? dto.starterCode : undefined,
        language: dto.type === 'CODE_SNIPPET' ? dto.language : undefined,
        createdBy: { connect: { id: actorId } },
      },
      this.isMcqFamily(dto.type) ? dto.options : undefined,
    );

    await auditLogService.record({
      action: 'QUESTION_CREATED',
      actorId,
      ipAddress,
      metadata: { questionId: created.id, title: created.title, type: created.type },
    });

    return created;
  }

  async update(
    id: string,
    dto: UpdateQuestionDto,
    actor: Actor,
    ipAddress?: string | null,
  ): Promise<Question> {
    const existing = await this.findOrThrow(id, actor);
    this.assertTypeConditionalFields(existing.type, dto, true);

    const updated = await this.repository.updateWithOptions(
      id,
      {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty } : {}),
        ...(dto.explanation !== undefined ? { explanation: dto.explanation } : {}),
        ...(dto.correctAnswers !== undefined ? { correctAnswers: dto.correctAnswers } : {}),
        ...(dto.starterCode !== undefined ? { starterCode: dto.starterCode } : {}),
        ...(dto.language !== undefined ? { language: dto.language } : {}),
      },
      dto.options,
    );

    await auditLogService.record({
      action: 'QUESTION_UPDATED',
      actorId: actor.id,
      ipAddress,
      // `options` is remapped into a fresh literal array — `QuestionOptionInput[]` (a named
      // interface, no index signature) fails Prisma's `InputJsonValue` structural check even
      // inside a `{ ...dto }` spread; a freshly-literal `.map()` result doesn't.
      metadata: {
        questionId: existing.id,
        changes: {
          ...dto,
          options: dto.options?.map((option) => ({ text: option.text, isCorrect: option.isCorrect })),
        },
      },
    });

    return updated;
  }

  async updateStatus(
    id: string,
    dto: UpdateQuestionStatusDto,
    actor: Actor,
    ipAddress?: string | null,
  ): Promise<Question> {
    const existing = await this.findOrThrow(id, actor);
    if (existing.status === dto.status) {
      throw new ConflictError(`Question is already ${dto.status.toLowerCase()}.`);
    }

    const updated = await this.repository.update(id, { status: dto.status });

    await auditLogService.record({
      action: 'QUESTION_STATUS_CHANGED',
      actorId: actor.id,
      ipAddress,
      metadata: { questionId: existing.id, from: existing.status, to: dto.status },
    });

    return updated;
  }

  async softDelete(id: string, actor: Actor, ipAddress?: string | null): Promise<void> {
    const existing = await this.findOrThrow(id, actor);
    await this.repository.softDelete(id);

    await auditLogService.record({
      action: 'QUESTION_DELETED',
      actorId: actor.id,
      ipAddress,
      metadata: { questionId: existing.id, title: existing.title },
    });
  }

  private isMcqFamily(type: QuestionType): boolean {
    return MCQ_FAMILY_TYPES.includes(type);
  }

  private isAnswerListType(type: QuestionType): boolean {
    return ANSWER_LIST_TYPES.includes(type);
  }

  /**
   * Enforces the discriminated-union-like shape of a question's type-conditional fields
   * (Prompt 6 § POST /questions, PATCH /questions/:id). `isUpdate` relaxes required-ness (a
   * partial update may omit a field entirely to leave it unchanged) but never the structural
   * invariants — a field that IS provided must still satisfy the same rules as create, and a
   * field that doesn't belong to this question's type is always rejected.
   */
  private assertTypeConditionalFields(
    type: QuestionType,
    dto: TypeConditionalFields,
    isUpdate: boolean,
  ): void {
    const isMcq = this.isMcqFamily(type);
    const isAnswerList = this.isAnswerListType(type);
    const isCodeSnippet = type === 'CODE_SNIPPET';

    if (!isMcq && dto.options !== undefined) {
      throw new BadRequestError(`Options are not applicable to ${type} questions.`);
    }
    if (!isAnswerList && dto.correctAnswers !== undefined) {
      throw new BadRequestError(`Correct answers are not applicable to ${type} questions.`);
    }
    if (!isCodeSnippet && (dto.starterCode !== undefined || dto.language !== undefined)) {
      throw new BadRequestError('Starter code and language are only applicable to CODE_SNIPPET questions.');
    }

    if (isMcq) {
      if (!isUpdate && dto.options === undefined) {
        throw new BadRequestError('Options are required for this question type.');
      }
      if (dto.options !== undefined) this.assertValidOptions(type, dto.options);
    }

    if (isAnswerList) {
      if (!isUpdate && dto.correctAnswers === undefined) {
        throw new BadRequestError('Correct answers are required for this question type.');
      }
      if (dto.correctAnswers !== undefined) this.assertValidCorrectAnswers(dto.correctAnswers);
    }
  }

  private assertValidOptions(type: QuestionType, options: QuestionOptionInput[]): void {
    if (options.length < MIN_QUESTION_OPTIONS || options.length > MAX_QUESTION_OPTIONS) {
      throw new BadRequestError(
        `Provide between ${MIN_QUESTION_OPTIONS} and ${MAX_QUESTION_OPTIONS} options.`,
      );
    }

    if (type === 'TRUE_FALSE' && options.length !== 2) {
      throw new BadRequestError('True/False questions must have exactly 2 options.');
    }

    const correctCount = options.filter((option) => option.isCorrect).length;

    if ((type === 'SINGLE_CORRECT_MCQ' || type === 'TRUE_FALSE') && correctCount !== 1) {
      throw new BadRequestError('Exactly one option must be marked correct for this question type.');
    }

    if (type === 'MULTIPLE_CORRECT' && correctCount < 1) {
      throw new BadRequestError('At least one option must be marked correct.');
    }
  }

  private assertValidCorrectAnswers(correctAnswers: string[]): void {
    if (correctAnswers.length < 1) {
      throw new BadRequestError('At least one correct answer is required.');
    }
    if (correctAnswers.some((answer) => answer.trim().length === 0)) {
      throw new BadRequestError('Correct answers cannot be empty.');
    }
    if (correctAnswers.some((answer) => answer.length > MAX_QUESTION_CORRECT_ANSWER_LENGTH)) {
      throw new BadRequestError(
        `Correct answers must be at most ${MAX_QUESTION_CORRECT_ANSWER_LENGTH} characters.`,
      );
    }
  }

  private async findOrThrow(id: string, actor: Actor) {
    const question = await this.repository.findByIdForActor(id, actor);
    if (!question) throw new NotFoundError('Question not found.');
    return question;
  }
}
