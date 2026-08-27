import type { Prisma, Role } from '@prisma/client';

import { ACCEPTED_QNA_ATTACHMENT_MIME_TYPES, MAX_QNA_ATTACHMENT_SIZE_BYTES } from '@/constants/qna';
import { auditLogService } from '@/services/audit-log.service';
import { BaseService } from '@/services/base.service';
import { storageProvider } from '@/storage';
import type { PaginatedData } from '@/types/common';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/utils/app-error';
import { logger } from '@/utils/logger';
import { buildPaginationMeta } from '@/utils/pagination.util';
import { assertUploadMatchesDeclaredType } from '@/utils/upload-safety.util';

import type {
  CreateQnaQuestionDto,
  UpdateQnaQuestionDto,
  UpdateQnaQuestionStatusDto,
} from './qna-questions.dto';
import {
  QnaQuestionsRepository,
  type QnaQuestionDetail,
  type QnaQuestionListItem,
} from './qna-questions.repository';
import type { QnaQuestionListFilters, QnaQuestionSortField } from './qna-questions.types';

interface Actor {
  id: string;
  role: Role;
}

/** The subset of visibility-related fields relevant to `assertVisibilityRules`, post-merge with any existing values on update. */
interface VisibilityInput {
  visibility: 'GROUP' | 'DEPARTMENT' | 'ORGANIZATION';
  groupId?: string | null;
  departmentId?: string | null;
}

// Business logic for the qna-questions module. Controllers call into this layer only.
export class QnaQuestionsService extends BaseService {
  constructor(protected readonly repository: QnaQuestionsRepository = new QnaQuestionsRepository()) {
    super();
  }

  async list(
    filters: QnaQuestionListFilters,
    actor: Actor,
    page: number,
    pageSize: number,
    sortBy: QnaQuestionSortField,
  ): Promise<PaginatedData<unknown>> {
    const { items, total } = await this.repository.findManyForActor(
      filters,
      actor,
      (page - 1) * pageSize,
      pageSize,
      sortBy,
    );
    return {
      items: items.map((item) => this.toListItemDto(item)),
      meta: buildPaginationMeta(page, pageSize, total),
    };
  }

  /**
   * A genuinely nonexistent (or soft-deleted) question is always a 404, regardless of role. An
   * existing question a Trainee lacks visibility access to is always a 403 — the two cases are
   * deliberately distinguished here (unlike e.g. `AssessmentsService#getById`'s "403 for
   * everything" precedent) per this module's build-prompt spec.
   *
   * Increments `viewCount` best-effort on every call — the returned DTO's `viewCount` is
   * overlaid with `+1` to reflect that write without needing a second fetch.
   */
  async getById(id: string, actor: Actor) {
    const dto = await this.fetchDetailDto(id, actor);

    try {
      await this.repository.incrementViewCount(id);
    } catch (error) {
      // Best-effort — a view-count write failure must not break the read.
      logger.error('Failed to increment qna question view count', { error, questionId: id });
    }

    return { ...dto, viewCount: dto.viewCount + 1 };
  }

  async create(dto: CreateQnaQuestionDto, actor: Actor, ipAddress?: string | null) {
    await this.assertVisibilityRules(
      { visibility: dto.visibility, groupId: dto.groupId, departmentId: dto.departmentId },
      actor,
    );
    await this.assertLinkedEntitiesExist(dto, actor);

    const created = await this.repository.createWithTags(
      {
        title: dto.title,
        description: dto.description,
        visibility: dto.visibility,
        author: { connect: { id: actor.id } },
        ...(dto.courseId ? { course: { connect: { id: dto.courseId } } } : {}),
        ...(dto.moduleId ? { module: { connect: { id: dto.moduleId } } } : {}),
        ...(dto.lessonId ? { lesson: { connect: { id: dto.lessonId } } } : {}),
        ...(dto.groupId ? { group: { connect: { id: dto.groupId } } } : {}),
        ...(dto.departmentId ? { department: { connect: { id: dto.departmentId } } } : {}),
      },
      dto.tags ?? [],
    );

    await auditLogService.record({
      action: 'QNA_QUESTION_CREATED',
      actorId: actor.id,
      ipAddress,
      metadata: { questionId: created.id, title: created.title, visibility: created.visibility },
    });

    return this.fetchDetailDto(created.id, actor);
  }

  async update(id: string, dto: UpdateQnaQuestionDto, actor: Actor, ipAddress?: string | null) {
    const existing = await this.findOwnedOrThrow(id, actor);

    const visibilityChanged =
      dto.visibility !== undefined || dto.groupId !== undefined || dto.departmentId !== undefined;
    if (visibilityChanged) {
      await this.assertVisibilityRules(
        {
          visibility: dto.visibility ?? existing.visibility,
          groupId: dto.groupId !== undefined ? dto.groupId : existing.groupId,
          departmentId: dto.departmentId !== undefined ? dto.departmentId : existing.departmentId,
        },
        actor,
      );
    }

    await this.assertLinkedEntitiesExist(
      {
        courseId: dto.courseId !== undefined ? dto.courseId : existing.courseId,
        moduleId: dto.moduleId !== undefined ? dto.moduleId : existing.moduleId,
        lessonId: dto.lessonId !== undefined ? dto.lessonId : existing.lessonId,
      },
      actor,
    );

    const data: Prisma.QnaQuestionUpdateInput = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
      ...(dto.groupId !== undefined
        ? { group: dto.groupId ? { connect: { id: dto.groupId } } : { disconnect: true } }
        : {}),
      ...(dto.departmentId !== undefined
        ? { department: dto.departmentId ? { connect: { id: dto.departmentId } } : { disconnect: true } }
        : {}),
      ...(dto.courseId !== undefined
        ? { course: dto.courseId ? { connect: { id: dto.courseId } } : { disconnect: true } }
        : {}),
      ...(dto.moduleId !== undefined
        ? { module: dto.moduleId ? { connect: { id: dto.moduleId } } : { disconnect: true } }
        : {}),
      ...(dto.lessonId !== undefined
        ? { lesson: dto.lessonId ? { connect: { id: dto.lessonId } } : { disconnect: true } }
        : {}),
    };

    await this.repository.update(id, data);

    if (dto.tags !== undefined) {
      await this.repository.replaceTags(id, dto.tags);
    }

    await auditLogService.record({
      action: 'QNA_QUESTION_UPDATED',
      actorId: actor.id,
      ipAddress,
      metadata: { questionId: existing.id, changes: { ...dto } },
    });

    return this.fetchDetailDto(id, actor);
  }

  async remove(id: string, actor: Actor, ipAddress?: string | null): Promise<void> {
    const existing = await this.findOwnedOrThrow(id, actor);

    await this.repository.softDelete(id);

    await auditLogService.record({
      action: 'QNA_QUESTION_DELETED',
      actorId: actor.id,
      ipAddress,
      metadata: { questionId: existing.id, title: existing.title },
    });
  }

  async updateStatus(id: string, dto: UpdateQnaQuestionStatusDto, actor: Actor, ipAddress?: string | null) {
    const existing = await this.findOwnedOrThrow(id, actor);

    await this.repository.update(id, { status: dto.status });

    await auditLogService.record({
      action: 'QNA_QUESTION_STATUS_CHANGED',
      actorId: actor.id,
      ipAddress,
      metadata: { questionId: existing.id, from: existing.status, to: dto.status },
    });

    return this.fetchDetailDto(id, actor);
  }

  /** Question author only (Prompt 7 § QUESTION CREATION MVP scope) — not Trainer/Super-Admin. */
  async uploadAttachment(questionId: string, file: Express.Multer.File, actor: Actor) {
    const question = await this.findOrThrow(questionId);
    if (question.authorId !== actor.id) {
      throw new ForbiddenError("Only the question's author can attach files to it.");
    }

    this.assertAcceptedMimeType(file.mimetype);
    this.assertFileSizeWithinLimit(file.size);
    await assertUploadMatchesDeclaredType(file);

    const { relativePath } = await storageProvider.save({
      buffer: file.buffer,
      originalName: file.originalname,
      entityType: 'qna-attachments',
    });

    const created = await this.repository.createAttachment({
      question: { connect: { id: questionId } },
      fileName: file.originalname,
      filePath: relativePath,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      uploadedBy: { connect: { id: actor.id } },
    });
    const { filePath: internalPath, ...safeAttachment } = created;
    void internalPath;
    return safeAttachment;
  }

  async removeAttachment(questionId: string, attachmentId: string, actor: Actor): Promise<void> {
    const question = await this.findOrThrow(questionId);
    const attachment = await this.repository.findAttachmentById(attachmentId);
    if (!attachment || attachment.questionId !== questionId) throw new NotFoundError('Attachment not found.');

    const isAuthor = question.authorId === actor.id;
    if (!isAuthor) await this.assertQuestionReadable(questionId, actor);

    try {
      await storageProvider.delete({ relativePath: attachment.filePath });
    } catch (error) {
      // Best-effort — a file already missing on disk must not block the row from being deleted.
      logger.error('Failed to delete qna attachment file from storage', {
        error,
        attachmentId,
        filePath: attachment.filePath,
      });
    }

    await this.repository.deleteAttachment(attachmentId);
  }

  async downloadAttachment(questionId: string, attachmentId: string, actor: Actor) {
    await this.assertQuestionReadable(questionId, actor);

    const attachment = await this.repository.findAttachmentById(attachmentId);
    if (!attachment || attachment.questionId !== questionId) throw new NotFoundError('Attachment not found.');

    const stream = await storageProvider.getReadStream({ relativePath: attachment.filePath });
    return { stream, attachment };
  }

  /**
   * Applies the Prompt 7 § GROUP VISIBILITY create/update invariants: `ORGANIZATION` allows
   * neither `groupId` nor `departmentId`; `GROUP` requires `groupId` (and forbids
   * `departmentId`) — a Trainee may only pick a group they belong to, while Trainer/Super-Admin
   * may pick any (existing) group; `DEPARTMENT` requires `departmentId` (and forbids `groupId`)
   * — a Trainee's value must equal their own `User.departmentId`, while Trainer/Super-Admin may
   * pick any (existing) department. Never leaks which groups/departments exist to a Trainee
   * making an invalid choice — always a generic 400.
   */
  private async assertVisibilityRules(input: VisibilityInput, actor: Actor): Promise<void> {
    if (input.visibility === 'ORGANIZATION') {
      if (input.groupId || input.departmentId) {
        throw new BadRequestError(
          'groupId and departmentId must not be set when visibility is ORGANIZATION.',
        );
      }
      return;
    }

    if (input.visibility === 'GROUP') {
      if (input.departmentId)
        throw new BadRequestError('departmentId must not be set when visibility is GROUP.');
      if (!input.groupId) throw new BadRequestError('groupId is required when visibility is GROUP.');

      if (actor.role === 'SUPER_ADMIN') {
        const group = await this.repository.findGroupById(input.groupId);
        if (!group) throw new BadRequestError('Group not found.');
      } else if (actor.role === 'TRAINER') {
        const manageable = await this.repository.isGroupManagedByTrainer(input.groupId, actor.id);
        if (!manageable) throw new BadRequestError('Group not found or outside your scope.');
      } else {
        const isMember = await this.repository.isGroupMember(input.groupId, actor.id);
        if (!isMember) throw new BadRequestError('You are not a member of the selected group.');
      }
      return;
    }

    // DEPARTMENT
    if (input.groupId) throw new BadRequestError('groupId must not be set when visibility is DEPARTMENT.');
    if (!input.departmentId)
      throw new BadRequestError('departmentId is required when visibility is DEPARTMENT.');

    if (actor.role === 'SUPER_ADMIN') {
      const department = await this.repository.findDepartmentById(input.departmentId);
      if (!department) throw new BadRequestError('Department not found.');
    } else if (actor.role === 'TRAINER') {
      const accessible = await this.repository.isDepartmentInTrainerScope(input.departmentId, actor.id);
      if (!accessible) throw new BadRequestError('Department not found or outside your scope.');
    } else {
      const user = await this.repository.findUserDepartmentId(actor.id);
      if (!user?.departmentId || user.departmentId !== input.departmentId) {
        throw new BadRequestError('You are not a member of the selected department.');
      }
    }
  }

  /**
   * The optional course/module/lesson linkage ids are only format-checked at the validation
   * layer — without an existence check, a well-formed-but-unknown UUID would surface as a
   * Prisma P2025 on `connect` (a 500), not a 4xx. Nulls mean "clear the link" and skip the
   * check.
   */
  private async assertLinkedEntitiesExist(
    dto: {
      courseId?: string | null;
      moduleId?: string | null;
      lessonId?: string | null;
    },
    actor: Actor,
  ): Promise<void> {
    const [course, module, lesson] = await Promise.all([
      dto.courseId ? this.repository.findCourseById(dto.courseId, actor) : Promise.resolve(null),
      dto.moduleId ? this.repository.findModuleById(dto.moduleId, actor) : Promise.resolve(null),
      dto.lessonId ? this.repository.findLessonById(dto.lessonId, actor) : Promise.resolve(null),
    ]);
    if (dto.courseId && !course) throw new BadRequestError('Course not found or outside your scope.');
    if (dto.moduleId && !module) throw new BadRequestError('Module not found or outside your scope.');
    if (dto.lessonId && !lesson) throw new BadRequestError('Lesson not found or outside your scope.');
    if (course && module && module.courseId !== course.id) {
      throw new BadRequestError('The selected module does not belong to the selected course.');
    }
    if (module && lesson && lesson.moduleId !== module.id) {
      throw new BadRequestError('The selected lesson does not belong to the selected module.');
    }
    if (course && lesson && lesson.module.courseId !== course.id) {
      throw new BadRequestError('The selected lesson does not belong to the selected course.');
    }
  }

  /** Fetch + visibility-gate + map to the detail DTO, without the view-count side effect (used by create/update/updateStatus, which return the fresh state of a write they just made — never a "view"). */
  private async fetchDetailDto(id: string, actor: Actor) {
    const question = await this.repository.findDetailById(id);
    if (!question) throw new NotFoundError('Question not found.');

    if (actor.role !== 'SUPER_ADMIN') {
      const accessible = await this.repository.isQuestionAccessibleToUser(id, actor.id, actor.role);
      if (!accessible) throw new ForbiddenError("You don't have permission to view this question.");
    }

    return this.toDetailDto(question, actor.id);
  }

  private async findOrThrow(id: string) {
    const question = await this.repository.findById(id);
    if (!question) throw new NotFoundError('Question not found.');
    return question;
  }

  /** Author or Trainer/Super-Admin only — used by update/remove/updateStatus. */
  private async findOwnedOrThrow(id: string, actor: Actor) {
    const question = await this.findOrThrow(id);
    if (question.authorId === actor.id || actor.role === 'SUPER_ADMIN') return question;
    if (actor.role !== 'TRAINER') {
      throw new ForbiddenError("You don't have permission to modify this question.");
    }
    const accessible = await this.repository.isQuestionAccessibleToUser(id, actor.id, actor.role);
    if (!accessible) throw new ForbiddenError("You don't have permission to modify this question.");
    return question;
  }

  /** Shared by `downloadAttachment` — Trainer/Super-Admin always allowed; anyone else must pass the visibility check. */
  private async assertQuestionReadable(questionId: string, actor: Actor): Promise<void> {
    await this.findOrThrow(questionId);
    if (actor.role === 'SUPER_ADMIN') return;

    const accessible = await this.repository.isQuestionAccessibleToUser(questionId, actor.id, actor.role);
    if (!accessible)
      throw new ForbiddenError("You don't have permission to access this question's attachments.");
  }

  private assertAcceptedMimeType(mimeType: string): void {
    if (!(ACCEPTED_QNA_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType)) {
      throw new BadRequestError(`Unsupported file type: ${mimeType}.`);
    }
  }

  private assertFileSizeWithinLimit(sizeBytes: number): void {
    if (sizeBytes > MAX_QNA_ATTACHMENT_SIZE_BYTES) {
      throw new BadRequestError(
        `File exceeds the maximum allowed size of ${MAX_QNA_ATTACHMENT_SIZE_BYTES} bytes.`,
      );
    }
  }

  private toListItemDto(question: QnaQuestionListItem) {
    return {
      id: question.id,
      title: question.title,
      status: question.status,
      visibility: question.visibility,
      authorId: question.authorId,
      authorName: `${question.author.firstName} ${question.author.lastName}`,
      tags: question.tags.map((questionTag) => questionTag.tag.name),
      answersCount: question.answers.length,
      hasVerifiedAnswer: question.answers.some((answer) => answer.isVerified),
      voteCount: question._count.votes,
      viewCount: question.viewCount,
      createdAt: question.createdAt,
    };
  }

  private toDetailDto(question: QnaQuestionDetail, actorId: string) {
    return {
      id: question.id,
      title: question.title,
      description: question.description,
      status: question.status,
      visibility: question.visibility,
      author: question.author,
      course: question.course ? { id: question.course.id, title: question.course.title } : null,
      module: question.module ? { id: question.module.id, title: question.module.title } : null,
      lesson: question.lesson ? { id: question.lesson.id, title: question.lesson.title } : null,
      groupId: question.groupId,
      departmentId: question.departmentId,
      tags: question.tags.map((questionTag) => questionTag.tag.name),
      viewCount: question.viewCount,
      voteCount: question.votes.length,
      myVote: question.votes.some((vote) => vote.userId === actorId),
      attachments: question.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        fileSizeBytes: attachment.fileSizeBytes,
        createdAt: attachment.createdAt,
      })),
      answers: question.answers.map((answer) => ({
        id: answer.id,
        content: answer.content,
        author: answer.author,
        isVerified: answer.isVerified,
        isPinned: answer.isPinned,
        verifiedBy: answer.verifiedBy,
        verifiedAt: answer.verifiedAt,
        voteCount: answer.votes.length,
        myVote: answer.votes.some((vote) => vote.userId === actorId),
        comments: answer.comments.map((comment) => ({
          id: comment.id,
          content: comment.content,
          author: comment.author,
          createdAt: comment.createdAt,
        })),
        createdAt: answer.createdAt,
        updatedAt: answer.updatedAt,
      })),
      comments: question.comments.map((comment) => ({
        id: comment.id,
        content: comment.content,
        author: comment.author,
        createdAt: comment.createdAt,
      })),
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  }
}

export const qnaQuestionsService = new QnaQuestionsService();
