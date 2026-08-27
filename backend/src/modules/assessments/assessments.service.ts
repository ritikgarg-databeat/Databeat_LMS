import type { Assessment, AssessmentQuestion, Prisma, Role } from '@prisma/client';

import { GroupsRepository } from '@/modules/groups/groups.repository';
import { notificationsService } from '@/modules/notifications';
// `@/modules/questions`'s index.ts only barrels its router export (`questionsRoutes`), not the
// repository — imported directly from its file instead, mirroring how `GroupsRepository` is
// imported directly by courses.service.ts rather than through `@/modules/groups`'s index.
// `findByIdWithOptions(id)` is the stable, already-agreed-upon contract (Prompt 6) this module
// depends on to snapshot a bank question's content — see README.md.
import { QuestionsRepository } from '@/modules/questions/questions.repository';
import { auditLogService } from '@/services/audit-log.service';
import { BaseService } from '@/services/base.service';
import type { PaginatedData } from '@/types/common';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/utils/app-error';
import { logger } from '@/utils/logger';
import { buildPaginationMeta } from '@/utils/pagination.util';

import type {
  AddAssessmentQuestionDto,
  AssignGroupDto,
  CreateAssessmentDto,
  DuplicateAssessmentDto,
  ReorderAssessmentQuestionsDto,
  UpdateAssessmentDto,
  UpdateAssessmentQuestionDto,
  UpdateAssessmentStatusDto,
} from './assessments.dto';
import { AssessmentsRepository, type AssessmentDetail } from './assessments.repository';
import type {
  AssessmentListFilters,
  AssessmentSortField,
  AssessmentStats,
  SortOrder,
} from './assessments.types';

interface Actor {
  id: string;
  role: Role;
}

// Business logic for the assessments module. Controllers call into this layer only.
export class AssessmentsService extends BaseService {
  constructor(
    protected readonly repository: AssessmentsRepository = new AssessmentsRepository(),
    private readonly groupsRepository: GroupsRepository = new GroupsRepository(),
    private readonly questionsRepository: QuestionsRepository = new QuestionsRepository(),
  ) {
    super();
  }

  async list(
    actor: Actor,
    filters: AssessmentListFilters,
    page: number,
    pageSize: number,
    sortBy: AssessmentSortField,
    sortOrder: SortOrder,
  ): Promise<PaginatedData<unknown>> {
    const { items, total } = await this.repository.findMany(
      filters,
      (page - 1) * pageSize,
      pageSize,
      sortBy,
      sortOrder,
      actor.role === 'TRAINER' ? actor.id : undefined,
    );
    return { items, meta: buildPaginationMeta(page, pageSize, total) };
  }

  async getStats(actor: Actor): Promise<AssessmentStats> {
    const trainerId = actor.role === 'TRAINER' ? actor.id : undefined;
    const [totalAssessments, publishedAssessments, draftAssessments, pendingGradingCount, upcomingCount] =
      await Promise.all([
        this.repository.countAll(trainerId),
        this.repository.countByStatus('PUBLISHED', trainerId),
        this.repository.countByStatus('DRAFT', trainerId),
        this.repository.countPendingGrading(trainerId),
        this.repository.countUpcoming(trainerId),
      ]);
    return { totalAssessments, publishedAssessments, draftAssessments, pendingGradingCount, upcomingCount };
  }

  /**
   * A trainee's (or any user's) assigned + published assessments, annotated with computed
   * `questionCount`/`maxMarks` and their own attempt summary (Prompt 6 § GET /assessments/mine).
   * Returns an empty list — not an error — for a user with no group memberships or no assigned
   * assessments.
   */
  async listMine(userId: string) {
    const assessmentIds = await this.repository.findAssignedAssessmentIds(userId);
    if (assessmentIds.length === 0) return [];

    const [assessments, attempts] = await Promise.all([
      this.repository.findManyForLearner(assessmentIds),
      this.repository.findAttemptsForUser(userId, assessmentIds),
    ]);

    const attemptByAssessmentId = new Map(attempts.map((attempt) => [attempt.assessmentId, attempt]));

    return assessments.map((assessment) => {
      const { questions, _count, ...rest } = assessment;
      const maxMarks = questions.reduce((sum, question) => sum + question.marks, 0);
      const attempt = attemptByAssessmentId.get(assessment.id);

      return {
        ...rest,
        questionCount: _count.questions,
        maxMarks,
        myAttempt: attempt
          ? {
              status: attempt.status,
              percentage: attempt.percentage,
              passed: attempt.passed,
              submittedAt: attempt.submittedAt,
            }
          : null,
      };
    });
  }

  async getById(id: string, actor: Actor) {
    const assessment = await this.repository.findDetailById(id);

    if (actor.role === 'TRAINEE') {
      if (!assessment) throw new ForbiddenError("You don't have permission to view this assessment.");
      const accessible = await this.repository.isAccessibleToUser(id, actor.id);
      if (!accessible) throw new ForbiddenError("You don't have permission to view this assessment.");
      // A Trainee only needs to know THEY have access — the identity of every other group this
      // assessment happens to be assigned to is management-only information (which cohorts share
      // this assessment isn't this endpoint's business to reveal to a learner).
      return this.toDetailDto(assessment, actor);
    }

    if (!assessment) throw new NotFoundError('Assessment not found.');
    await this.assertAssessmentReadable(id, actor);
    return this.toDetailDto(assessment, actor);
  }

  async create(dto: CreateAssessmentDto, actor: Actor, ipAddress?: string | null): Promise<Assessment> {
    const negativeMarkingEnabled = dto.negativeMarkingEnabled ?? false;
    this.assertNegativeMarkingRule(negativeMarkingEnabled, dto.negativeMarksPerWrongAnswer);
    this.assertDateRange(dto.availableFrom, dto.dueDate);

    const created = await this.repository.create({
      title: dto.title,
      description: dto.description,
      durationMinutes: dto.durationMinutes,
      passingPercentage: dto.passingPercentage,
      availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      instructions: dto.instructions,
      negativeMarkingEnabled,
      negativeMarksPerWrongAnswer: negativeMarkingEnabled ? dto.negativeMarksPerWrongAnswer : null,
      randomizeQuestions: dto.randomizeQuestions ?? false,
      showResultImmediately: dto.showResultImmediately ?? true,
      status: 'DRAFT',
      createdBy: { connect: { id: actor.id } },
    });

    await auditLogService.record({
      action: 'ASSESSMENT_CREATED',
      actorId: actor.id,
      ipAddress,
      metadata: { assessmentId: created.id, title: created.title },
    });

    return created;
  }

  async update(
    id: string,
    dto: UpdateAssessmentDto,
    actor: Actor,
    ipAddress?: string | null,
  ): Promise<Assessment> {
    const existing = await this.findOrThrow(id);
    await this.assertAssessmentInScope(id, actor);

    const definitionFields: Array<keyof UpdateAssessmentDto> = [
      'durationMinutes',
      'passingPercentage',
      'availableFrom',
      'dueDate',
      'negativeMarkingEnabled',
      'negativeMarksPerWrongAnswer',
      'randomizeQuestions',
      'showResultImmediately',
    ];
    if (definitionFields.some((field) => dto[field] !== undefined)) {
      await this.assertDefinitionIsEditable(id);
    }

    const negativeMarkingEnabled = dto.negativeMarkingEnabled ?? existing.negativeMarkingEnabled;
    const negativeMarksPerWrongAnswer =
      dto.negativeMarksPerWrongAnswer !== undefined
        ? dto.negativeMarksPerWrongAnswer
        : existing.negativeMarksPerWrongAnswer;
    this.assertNegativeMarkingRule(negativeMarkingEnabled, negativeMarksPerWrongAnswer);

    const effectiveAvailableFrom =
      dto.availableFrom !== undefined ? dto.availableFrom : (existing.availableFrom?.toISOString() ?? null);
    const effectiveDueDate =
      dto.dueDate !== undefined ? dto.dueDate : (existing.dueDate?.toISOString() ?? null);
    this.assertDateRange(effectiveAvailableFrom, effectiveDueDate);

    const updated = await this.repository.update(id, {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.durationMinutes !== undefined ? { durationMinutes: dto.durationMinutes } : {}),
      ...(dto.passingPercentage !== undefined ? { passingPercentage: dto.passingPercentage } : {}),
      ...(dto.availableFrom !== undefined
        ? { availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null }
        : {}),
      ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null } : {}),
      ...(dto.instructions !== undefined ? { instructions: dto.instructions } : {}),
      ...(dto.negativeMarkingEnabled !== undefined
        ? { negativeMarkingEnabled: dto.negativeMarkingEnabled }
        : {}),
      ...(dto.negativeMarksPerWrongAnswer !== undefined
        ? { negativeMarksPerWrongAnswer: dto.negativeMarksPerWrongAnswer }
        : {}),
      ...(dto.randomizeQuestions !== undefined ? { randomizeQuestions: dto.randomizeQuestions } : {}),
      ...(dto.showResultImmediately !== undefined
        ? { showResultImmediately: dto.showResultImmediately }
        : {}),
    });

    await auditLogService.record({
      action: 'ASSESSMENT_UPDATED',
      actorId: actor.id,
      ipAddress,
      metadata: { assessmentId: existing.id, changes: { ...dto } },
    });

    return updated;
  }

  async updateStatus(
    id: string,
    dto: UpdateAssessmentStatusDto,
    actor: Actor,
    ipAddress?: string | null,
  ): Promise<Assessment> {
    const existing = await this.findOrThrow(id);
    await this.assertAssessmentInScope(id, actor);
    if (existing.status === dto.status) {
      throw new ConflictError(`Assessment is already ${dto.status.toLowerCase()}.`);
    }

    if (dto.status === 'PUBLISHED') {
      const questionCount = await this.repository.countQuestions(id);
      if (questionCount === 0) {
        throw new BadRequestError('Cannot publish an assessment with no questions.');
      }
    }

    const updated = await this.repository.update(id, { status: dto.status });

    await auditLogService.record({
      action: 'ASSESSMENT_STATUS_CHANGED',
      actorId: actor.id,
      ipAddress,
      metadata: { assessmentId: existing.id, from: existing.status, to: dto.status },
    });

    return updated;
  }

  async releaseResults(id: string, actor: Actor, ipAddress?: string | null): Promise<Assessment> {
    const existing = await this.findOrThrow(id);
    await this.assertAssessmentInScope(id, actor);
    if (existing.showResultImmediately) {
      throw new ConflictError('Results are already configured to be shown immediately.');
    }
    if (existing.resultsReleasedAt) {
      throw new ConflictError('Results have already been released.');
    }
    if ((await this.repository.countSubmittedAttempts(id)) === 0) {
      throw new ConflictError('There are no submitted attempts to release yet.');
    }

    const releasedAt = new Date();
    const updated = await this.repository.update(id, { resultsReleasedAt: releasedAt });

    await auditLogService.record({
      action: 'ASSESSMENT_RESULTS_RELEASED',
      actorId: actor.id,
      ipAddress,
      metadata: { assessmentId: id, releasedAt: releasedAt.toISOString() },
    });

    const learnerIds = await this.repository.findSubmittedAttemptUserIds(id);
    await notificationsService
      .notifyMany(learnerIds, {
        type: 'ASSESSMENT_RESULTS_RELEASED',
        title: 'Assessment results released',
        message: `Results for "${existing.title}" are now available.`,
        relatedEntityType: 'assessment',
        relatedEntityId: id,
      })
      .catch((error: unknown) => {
        logger.error('Failed to send assessment-results-released notifications', { error, assessmentId: id });
      });

    return updated;
  }

  async softDelete(id: string, actor: Actor, ipAddress?: string | null): Promise<void> {
    const existing = await this.findOrThrow(id);
    await this.assertAssessmentInScope(id, actor);
    await this.repository.softDelete(id);

    await auditLogService.record({
      action: 'ASSESSMENT_DELETED',
      actorId: actor.id,
      ipAddress,
      metadata: { assessmentId: existing.id, title: existing.title },
    });
  }

  async duplicate(
    id: string,
    dto: DuplicateAssessmentDto,
    actor: Actor,
    ipAddress?: string | null,
  ): Promise<Assessment> {
    await this.findOrThrow(id);
    await this.assertAssessmentReadable(id, actor);

    const created = await this.repository.duplicate(id, dto.title, actor.id);

    await auditLogService.record({
      action: 'ASSESSMENT_CREATED',
      actorId: actor.id,
      ipAddress,
      metadata: { assessmentId: created.id, title: created.title, duplicatedFromId: id },
    });

    return created;
  }

  async listAssignments(assessmentId: string, actor: Actor) {
    await this.findOrThrow(assessmentId);
    await this.assertAssessmentReadable(assessmentId, actor);
    const assignments = await this.repository.listAssignments(
      assessmentId,
      actor.role === 'TRAINER' ? actor.id : undefined,
    );
    return assignments.map((assignment) => ({
      id: assignment.group.id,
      name: assignment.group.name,
      code: assignment.group.code,
      memberCount: assignment.group._count.members,
    }));
  }

  async assignGroup(assessmentId: string, dto: AssignGroupDto, actor: Actor, ipAddress?: string | null) {
    const assessment = await this.findOrThrow(assessmentId);
    await this.assertAssessmentReadable(assessmentId, actor);
    const group = await this.groupsRepository.findById(dto.groupId);
    if (!group) throw new BadRequestError('Group not found.');
    if (actor.role === 'TRAINER' && group.trainerId !== actor.id) {
      throw new ForbiddenError("You don't have permission to assign this group.");
    }

    const existing = await this.repository.findAssignment(assessmentId, dto.groupId);
    if (existing) throw new ConflictError('This group is already assigned to the assessment.');

    const created = await this.repository.createAssignment(assessmentId, dto.groupId, actor.id);

    const memberUserIds = await this.repository.findGroupMemberUserIds(dto.groupId);
    if (memberUserIds.length > 0) {
      // Best-effort: the group is already assigned (committed above) — a transient notification
      // failure must not surface as a failed request, since a client retry after such a failure
      // would otherwise hit the `@@unique([assessmentId, groupId])` conflict on an assignment
      // that actually succeeded the first time.
      await notificationsService
        .notifyMany(memberUserIds, {
          type: 'ASSESSMENT_ASSIGNED',
          title: 'New assessment assigned',
          message: `"${assessment.title}" has been assigned to you.`,
          relatedEntityType: 'assessment',
          relatedEntityId: assessment.id,
        })
        .catch((error: unknown) => {
          logger.error('Failed to send assessment-assigned notifications', {
            error,
            assessmentId,
            groupId: dto.groupId,
          });
        });
    }

    await auditLogService.record({
      action: 'ASSESSMENT_ASSIGNED_TO_GROUP',
      actorId: actor.id,
      ipAddress,
      metadata: { assessmentId, groupId: dto.groupId },
    });

    return created;
  }

  async unassignGroup(
    assessmentId: string,
    groupId: string,
    actor: Actor,
    ipAddress?: string | null,
  ): Promise<void> {
    await this.findOrThrow(assessmentId);
    await this.assertAssessmentReadable(assessmentId, actor);
    const group = await this.groupsRepository.findById(groupId);
    if (actor.role === 'TRAINER' && group?.trainerId !== actor.id) {
      throw new ForbiddenError("You don't have permission to unassign this group.");
    }
    const existing = await this.repository.findAssignment(assessmentId, groupId);
    if (!existing) throw new NotFoundError('This group is not assigned to the assessment.');

    await this.repository.deleteAssignment(assessmentId, groupId);

    await auditLogService.record({
      action: 'ASSESSMENT_UNASSIGNED_FROM_GROUP',
      actorId: actor.id,
      ipAddress,
      metadata: { assessmentId, groupId },
    });
  }

  async listQuestions(assessmentId: string, actor: Actor): Promise<AssessmentQuestion[]> {
    await this.findOrThrow(assessmentId);
    await this.assertAssessmentReadable(assessmentId, actor);
    return this.repository.listQuestions(assessmentId);
  }

  async addQuestion(
    assessmentId: string,
    dto: AddAssessmentQuestionDto,
    actor: Actor,
    ipAddress?: string | null,
  ) {
    await this.findOrThrow(assessmentId);
    await this.assertAssessmentInScope(assessmentId, actor);
    await this.assertDefinitionIsEditable(assessmentId);

    const bankQuestion = await this.questionsRepository.findByIdWithOptions(dto.questionId);
    if (
      !bankQuestion ||
      bankQuestion.deletedAt !== null ||
      (actor.role === 'TRAINER' && bankQuestion.createdById !== actor.id)
    ) {
      throw new BadRequestError('Question not found.');
    }

    const nextOrder = await this.repository.findNextOrder(assessmentId);

    const snapshotOptions =
      bankQuestion.options.length > 0
        ? bankQuestion.options.map((option) => ({
            id: option.id,
            text: option.text,
            isCorrect: option.isCorrect,
            order: option.order,
          }))
        : undefined;

    const created = await this.repository.createQuestion({
      assessment: { connect: { id: assessmentId } },
      question: { connect: { id: bankQuestion.id } },
      order: nextOrder,
      marks: dto.marks,
      snapshotTitle: bankQuestion.title,
      snapshotType: bankQuestion.type,
      snapshotExplanation: bankQuestion.explanation,
      snapshotOptions: (snapshotOptions as Prisma.InputJsonValue | undefined) ?? undefined,
      snapshotCorrectAnswers: (bankQuestion.correctAnswers as Prisma.InputJsonValue | undefined) ?? undefined,
      snapshotStarterCode: bankQuestion.starterCode,
      snapshotLanguage: bankQuestion.language,
    });

    await auditLogService.record({
      action: 'ASSESSMENT_QUESTION_ADDED',
      actorId: actor.id,
      ipAddress,
      metadata: {
        assessmentId,
        assessmentQuestionId: created.id,
        questionId: dto.questionId,
        marks: dto.marks,
      },
    });

    return created;
  }

  /**
   * Marks-only re-weighting — the question's snapshotted content is immutable once added
   * (re-add via delete + create to pull fresh content from the bank). Reuses the
   * ASSESSMENT_UPDATED audit action (rather than a dedicated one) with metadata identifying the
   * exact marks change, per Prompt 6's "your call, document whichever you pick."
   */
  async updateQuestionMarks(
    assessmentId: string,
    assessmentQuestionId: string,
    dto: UpdateAssessmentQuestionDto,
    actor: Actor,
    ipAddress?: string | null,
  ) {
    await this.findOrThrow(assessmentId);
    await this.assertAssessmentInScope(assessmentId, actor);
    await this.assertDefinitionIsEditable(assessmentId);
    const existing = await this.repository.findQuestion(assessmentId, assessmentQuestionId);
    if (!existing) throw new NotFoundError('Question not found on this assessment.');

    const updated = await this.repository.updateQuestionMarks(assessmentQuestionId, dto.marks);

    await auditLogService.record({
      action: 'ASSESSMENT_UPDATED',
      actorId: actor.id,
      ipAddress,
      metadata: {
        assessmentId,
        assessmentQuestionId,
        marksChangedFrom: existing.marks,
        marksChangedTo: dto.marks,
      },
    });

    return updated;
  }

  async removeQuestion(
    assessmentId: string,
    assessmentQuestionId: string,
    actor: Actor,
    ipAddress?: string | null,
  ): Promise<void> {
    await this.findOrThrow(assessmentId);
    await this.assertAssessmentInScope(assessmentId, actor);
    const existing = await this.repository.findQuestion(assessmentId, assessmentQuestionId);
    if (!existing) throw new NotFoundError('Question not found on this assessment.');

    // AssessmentAnswer rows cascade-delete with their AssessmentQuestion (schema
    // onDelete: Cascade) — once a trainee has attempted this assessment, removing a question
    // would silently destroy that trainee's (possibly already-graded) answer history for it.
    // Once any attempt exists, questions can only be re-weighted (marks) or reordered, never
    // removed — a trainer who genuinely needs to retire a question should archive/duplicate the
    // assessment instead.
    const attemptCount = await this.repository.countAttempts(assessmentId);
    if (attemptCount > 0) {
      throw new ConflictError(
        'This question cannot be removed because trainees have already attempted this assessment — removing it would delete their recorded answers.',
      );
    }

    await this.repository.deleteQuestion(assessmentQuestionId);

    await auditLogService.record({
      action: 'ASSESSMENT_QUESTION_REMOVED',
      actorId: actor.id,
      ipAddress,
      metadata: { assessmentId, assessmentQuestionId, questionId: existing.questionId },
    });
  }

  async reorderQuestions(
    assessmentId: string,
    dto: ReorderAssessmentQuestionsDto,
    actor: Actor,
    ipAddress?: string | null,
  ): Promise<void> {
    await this.findOrThrow(assessmentId);
    await this.assertAssessmentInScope(assessmentId, actor);
    await this.assertDefinitionIsEditable(assessmentId);

    if (new Set(dto.orderedIds).size !== dto.orderedIds.length) {
      throw new BadRequestError('orderedIds must not contain duplicate ids.');
    }

    const [existing, totalCount] = await Promise.all([
      this.repository.listQuestions(assessmentId),
      this.repository.countQuestions(assessmentId),
    ]);
    const existingIds = new Set(existing.map((question) => question.id));
    const allBelong = dto.orderedIds.every((id) => existingIds.has(id));
    if (!allBelong) {
      throw new BadRequestError('orderedIds must only contain questions that belong to this assessment.');
    }
    // A partial submission would leave the untouched siblings' `order` values as-is, colliding
    // with the freshly-assigned 0..N-1 range and corrupting the assessment's question ordering
    // (this exact bug was found and fixed in Prompt 5's module/lesson reorder endpoints).
    if (dto.orderedIds.length !== totalCount) {
      throw new BadRequestError('orderedIds must include every question in this assessment.');
    }

    await this.repository.reorderQuestions(dto.orderedIds);

    await auditLogService.record({
      action: 'ASSESSMENT_QUESTIONS_REORDERED',
      actorId: actor.id,
      ipAddress,
      metadata: { assessmentId, orderedIds: dto.orderedIds },
    });
  }

  /** Freeze scoring, timing, and structure once the first trainee starts an attempt. */
  private async assertDefinitionIsEditable(assessmentId: string): Promise<void> {
    if ((await this.repository.countAttempts(assessmentId)) > 0) {
      throw new ConflictError(
        'This assessment definition is locked because a trainee has already started it. Duplicate the assessment to create a new revision.',
      );
    }
  }

  private async assertAssessmentInScope(id: string, actor: Actor): Promise<void> {
    if (actor.role === 'TRAINER' && !(await this.repository.isOwnedByTrainer(id, actor.id))) {
      throw new ForbiddenError("You don't have permission to manage this assessment.");
    }
  }

  private async assertAssessmentReadable(id: string, actor: Actor): Promise<void> {
    if (actor.role === 'TRAINER' && !(await this.repository.isInTrainerScope(id, actor.id))) {
      throw new ForbiddenError("You don't have permission to access this assessment.");
    }
  }

  private async toDetailDto(assessment: AssessmentDetail, actor: Actor) {
    const { _count, groupAssignments, ...rest } = assessment;
    const maxMarks = await this.repository.sumMarks(assessment.id);

    const visibleAssignments =
      actor.role === 'SUPER_ADMIN'
        ? groupAssignments
        : actor.role === 'TRAINER'
          ? groupAssignments.filter((assignment) => assignment.group.trainerId === actor.id)
          : [];

    return {
      ...rest,
      questionCount: _count.questions,
      maxMarks,
      assignedGroups: visibleAssignments.map((assignment) => ({
        id: assignment.group.id,
        name: assignment.group.name,
        code: assignment.group.code,
      })),
    };
  }

  private async findOrThrow(id: string) {
    const assessment = await this.repository.findById(id);
    if (!assessment) throw new NotFoundError('Assessment not found.');
    return assessment;
  }

  private assertNegativeMarkingRule(enabled: boolean, value: number | null | undefined): void {
    if (enabled && (value === undefined || value === null)) {
      throw new BadRequestError(
        'negativeMarksPerWrongAnswer is required when negativeMarkingEnabled is true.',
      );
    }
    if (!enabled && value !== undefined && value !== null) {
      throw new BadRequestError(
        'negativeMarksPerWrongAnswer must not be set when negativeMarkingEnabled is false.',
      );
    }
  }

  private assertDateRange(availableFrom?: string | null, dueDate?: string | null): void {
    if (availableFrom && dueDate && new Date(availableFrom) > new Date(dueDate)) {
      throw new BadRequestError('availableFrom must be on or before dueDate.');
    }
  }
}
