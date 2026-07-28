import type {
  Assessment,
  AssessmentAnswer,
  AssessmentAttempt,
  AssessmentQuestion,
  Prisma,
  QuestionType,
} from '@prisma/client';

import { ACCEPTED_LESSON_MIME_TYPES, MAX_LESSON_FILE_SIZE_BYTES } from '@/constants/file-types';
import { auditLogService } from '@/services/audit-log.service';
import { BaseService } from '@/services/base.service';
import { storageProvider } from '@/storage';
import type { PaginatedData } from '@/types/common';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/utils/app-error';
import { buildPaginationMeta } from '@/utils/pagination.util';

import type { GradeAnswerDto, SaveAnswerDto } from './assessment-attempts.dto';
import { AssessmentAttemptsRepository, type AnswerGradeUpsert, type AttemptListFilters } from './assessment-attempts.repository';
import {
  AUTO_GRADABLE_TEXT_QUESTION_TYPES,
  MANUAL_REVIEW_QUESTION_TYPES,
  OPTION_BASED_QUESTION_TYPES,
  type AttemptSummary,
  type AttemptWithGradedQuestions,
  type AttemptWithSanitizedQuestions,
  type GradedQuestionView,
  type SanitizedQuestionView,
  type SavedAnswerView,
  type SnapshotOption,
  type TrainerAttemptListItem,
} from './assessment-attempts.types';

/** Fisher-Yates shuffle — used to build `AssessmentAttempt.questionOrder` when `randomizeQuestions` is on. */
function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i] as T;
    shuffled[i] = shuffled[j] as T;
    shuffled[j] = temp;
  }
  return shuffled;
}

/** trim + lowercase + collapse internal whitespace to a single space (Prompt 6 § AUTO GRADING). */
function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((value) => b.has(value));
}

function isOptionBasedType(type: QuestionType): boolean {
  return (OPTION_BASED_QUESTION_TYPES as readonly QuestionType[]).includes(type);
}

function isAutoGradableTextType(type: QuestionType): boolean {
  return (AUTO_GRADABLE_TEXT_QUESTION_TYPES as readonly QuestionType[]).includes(type);
}

function isManualReviewType(type: QuestionType): boolean {
  return (MANUAL_REVIEW_QUESTION_TYPES as readonly QuestionType[]).includes(type);
}

// Business logic for the assessment-attempts module. Controllers call into this layer only.
//
// This module owns the AssessmentAttempt/AssessmentAnswer models exclusively and implements its
// own, self-contained copy of the classroom trainee-accessibility rule (Prompt 5 § SECURITY,
// mirrored per Prompt 6's instructions against Assessment/AssessmentGroupAssignment instead of
// Course/CourseGroupAssignment) rather than importing from the assessments module — see README.md.
//
// RBAC is enforced at the route layer (`requireRole` — see assessment-attempts.routes.ts): every
// method here that takes a `userId` is trainee-scoped (operates on "my" attempt only), and every
// method that takes an `assessmentId`/`attemptId` pair without a `userId` is Trainer/Super-Admin
// scoped. Nothing here re-checks role — only "is this trainee actually allowed to see/touch this
// particular assessment/attempt".
export class AssessmentAttemptsService extends BaseService {
  constructor(protected readonly repository: AssessmentAttemptsRepository = new AssessmentAttemptsRepository()) {
    super();
  }

  // ---------------------------------------------------------------------------------------
  // Trainee-facing
  // ---------------------------------------------------------------------------------------

  async start(assessmentId: string, userId: string): Promise<AttemptWithSanitizedQuestions> {
    const assessment = await this.assertAssessmentAccessibleOrThrow(assessmentId, userId);

    const existingAttempt = await this.repository.findAttemptByAssessmentAndUser(assessmentId, userId);
    if (existingAttempt) {
      if (existingAttempt.status !== 'IN_PROGRESS') {
        throw new ConflictError('You have already submitted this assessment.');
      }
      // Idempotent resume — this IS the resume feature (Prompt 6 § POST /start), no separate endpoint.
      return this.buildAttemptWithSanitizedQuestions(assessment, existingAttempt);
    }

    const now = new Date();
    if (assessment.availableFrom && now < assessment.availableFrom) {
      throw new BadRequestError('This assessment is not yet available.');
    }
    if (assessment.dueDate && now > assessment.dueDate) {
      throw new BadRequestError('The deadline for this assessment has passed.');
    }

    const questions = await this.repository.findAssessmentQuestions(assessmentId);
    const questionOrder = assessment.randomizeQuestions ? shuffle(questions.map((question) => question.id)) : null;

    const created = await this.repository.createAttempt({
      assessment: { connect: { id: assessmentId } },
      user: { connect: { id: userId } },
      status: 'IN_PROGRESS',
      startedAt: now,
      ...(questionOrder ? { questionOrder } : {}),
    });

    return this.buildAttemptWithSanitizedQuestions(assessment, created, questions);
  }

  async getMine(assessmentId: string, userId: string): Promise<AttemptWithSanitizedQuestions | AttemptWithGradedQuestions> {
    // Accessibility is re-checked on every trainee-facing action (Prompt 6 § RBAC ground rules),
    // not just at `/start` — mirrors the progress module's `getLessonProgress` precedent, which
    // re-validates course accessibility on every read rather than only when progress is created.
    const assessment = await this.assertAssessmentAccessibleOrThrow(assessmentId, userId);

    const attempt = await this.repository.findAttemptByAssessmentAndUser(assessmentId, userId);
    if (!attempt) throw new NotFoundError("You haven't started this assessment yet.");

    if (attempt.status !== 'GRADED') {
      // IN_PROGRESS / SUBMITTED / PENDING_REVIEW: they haven't seen graded results yet, so
      // this always returns the same sanitized (answer-key-free) view as `/start`.
      return this.buildAttemptWithSanitizedQuestions(assessment, attempt);
    }

    if (!assessment.showResultImmediately) {
      // "Show Result Immediately" toggle is OFF. Withholding forever would be unusual, but a
      // trainer-triggered reveal mechanism is explicitly out of scope for this endpoint (Prompt 6
      // § GET /mine) — so the simplest reasonable behavior is: results are simply never
      // auto-revealed to the trainee through THIS endpoint. The scored data still exists in the
      // DB untouched (a Trainer/Super-Admin can always see it via the trainer-only endpoints);
      // it's only masked in this particular response.
      return {
        attempt: { ...this.toAttemptSummary(attempt), totalScore: null, percentage: null, passed: null },
        questions: [],
      };
    }

    const [questions, answers] = await Promise.all([
      this.repository.findAssessmentQuestions(assessmentId),
      this.repository.findAnswersByAttemptId(attempt.id),
    ]);

    return {
      attempt: this.toAttemptSummary(attempt),
      questions: this.buildGradedQuestions(questions, attempt.questionOrder, answers),
    };
  }

  async saveAnswer(
    assessmentId: string,
    assessmentQuestionId: string,
    dto: SaveAnswerDto,
    userId: string,
  ): Promise<SavedAnswerView> {
    await this.assertAssessmentAccessibleOrThrow(assessmentId, userId);
    const attempt = await this.findOwnInProgressAttemptOrThrow(assessmentId, userId);
    const question = await this.findAssessmentQuestionOrThrow(assessmentId, assessmentQuestionId);

    if (question.snapshotType === 'FILE_UPLOAD') {
      throw new BadRequestError(
        'FILE_UPLOAD questions are answered via POST /mine/answers/:assessmentQuestionId/upload.',
      );
    }

    const updated = isOptionBasedType(question.snapshotType)
      ? await this.repository.upsertAnswer(attempt.id, assessmentQuestionId, {
          selectedOptionIds: dto.selectedOptionIds ?? [],
          textAnswer: null,
          fileRelativePath: null,
          fileOriginalFilename: null,
        })
      : await this.repository.upsertAnswer(attempt.id, assessmentQuestionId, {
          selectedOptionIds: null,
          textAnswer: dto.textAnswer ?? null,
          fileRelativePath: null,
          fileOriginalFilename: null,
        });

    return this.toSavedAnswerView(updated);
  }

  async uploadAnswer(
    assessmentId: string,
    assessmentQuestionId: string,
    file: Express.Multer.File,
    userId: string,
  ): Promise<SavedAnswerView> {
    await this.assertAssessmentAccessibleOrThrow(assessmentId, userId);
    const attempt = await this.findOwnInProgressAttemptOrThrow(assessmentId, userId);
    const question = await this.findAssessmentQuestionOrThrow(assessmentId, assessmentQuestionId);

    if (question.snapshotType !== 'FILE_UPLOAD') {
      throw new BadRequestError('This question does not accept a file upload — use PUT to save your answer instead.');
    }

    this.assertAcceptedMimeType(file.mimetype);
    this.assertFileSizeWithinLimit(file.size);

    const previous = await this.repository.findAnswerByAttemptAndQuestion(attempt.id, assessmentQuestionId);

    const { relativePath } = await storageProvider.save({
      buffer: file.buffer,
      originalName: file.originalname,
      entityType: 'assessment-submissions',
    });

    const updated = await this.repository.upsertAnswer(attempt.id, assessmentQuestionId, {
      selectedOptionIds: null,
      textAnswer: null,
      fileRelativePath: relativePath,
      fileOriginalFilename: file.originalname,
    });

    if (previous?.fileRelativePath) {
      // Best-effort: a re-upload replacing a previous file must not fail the request if the old
      // file is already missing on disk (mirrors resources.service.ts#remove's precedent).
      await storageProvider.delete({ relativePath: previous.fileRelativePath }).catch(() => undefined);
    }

    return this.toSavedAnswerView(updated);
  }

  /**
   * Auto-grades every objective-type answer, leaves subjective/file-upload types for manual
   * review, and finalizes the attempt (Prompt 6 § POST /mine/submit).
   */
  async submit(assessmentId: string, userId: string, ipAddress?: string | null): Promise<AttemptSummary> {
    // Captured before the real DB reads below so `submittedAt` (below) and `gradedAt` (for the
    // auto-graded branch) bracket genuine server time — impact-metrics.repository.ts's
    // "auto-grading latency" report reads gradedAt minus submittedAt, so this needs to span real
    // work (these reads plus the grading loop), not just the synchronous grading loop alone,
    // which would make the report always compute ~0ms regardless of real cost.
    const requestReceivedAt = new Date();

    const assessment = await this.assertAssessmentAccessibleOrThrow(assessmentId, userId);
    const attempt = await this.findOwnInProgressAttemptOrThrow(assessmentId, userId);

    const [questions, existingAnswers] = await Promise.all([
      this.repository.findAssessmentQuestions(assessmentId),
      this.repository.findAnswersByAttemptId(attempt.id),
    ]);
    const existingByQuestionId = new Map(existingAnswers.map((answer) => [answer.assessmentQuestionId, answer]));

    let autoScoreBeforePenalty = 0;
    let wrongAttemptedAutoGradedCount = 0;
    let hasManualReviewQuestion = false;
    const answerGrades: AnswerGradeUpsert[] = [];

    for (const question of questions) {
      const existing = existingByQuestionId.get(question.id);
      // "Attempted" = an answer row exists at all (Prompt 6 § negative marking parenthetical),
      // regardless of its content — computed from the pre-submission snapshot above, never from
      // rows this very submission pass is about to create.
      const attempted = existing !== undefined;

      if (isManualReviewType(question.snapshotType)) {
        hasManualReviewQuestion = true;
        if (!attempted) {
          // Placeholder row so a trainer always has something to grade via `:answerId`, even for
          // a manual-review question the trainee skipped entirely — otherwise that question could
          // never be graded and the attempt would be stuck in PENDING_REVIEW forever.
          answerGrades.push({ assessmentQuestionId: question.id, isCorrect: null, marksAwarded: null });
        }
        continue;
      }

      const isCorrect = this.isAutoGradedAnswerCorrect(question, existing);
      const marksAwarded = isCorrect ? question.marks : 0;
      autoScoreBeforePenalty += marksAwarded;
      if (attempted && !isCorrect) wrongAttemptedAutoGradedCount += 1;
      answerGrades.push({ assessmentQuestionId: question.id, isCorrect, marksAwarded });
    }

    const negativeMarksTotal = assessment.negativeMarkingEnabled
      ? wrongAttemptedAutoGradedCount * (assessment.negativeMarksPerWrongAnswer ?? 0)
      : 0;
    const autoScore = Math.max(0, autoScoreBeforePenalty - negativeMarksTotal);

    const now = new Date();
    const timeSpentSeconds = Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000);
    const maxMarks = questions.reduce((sum, question) => sum + question.marks, 0);

    const attemptData: Prisma.AssessmentAttemptUpdateInput = hasManualReviewQuestion
      ? { status: 'PENDING_REVIEW', autoScore, submittedAt: requestReceivedAt, timeSpentSeconds }
      : {
          status: 'GRADED',
          autoScore,
          manualScore: 0,
          totalScore: autoScore,
          percentage: maxMarks === 0 ? 0 : Math.round((autoScore / maxMarks) * 100),
          passed: (maxMarks === 0 ? 0 : Math.round((autoScore / maxMarks) * 100)) >= assessment.passingPercentage,
          gradedAt: now,
          submittedAt: requestReceivedAt,
          timeSpentSeconds,
        };

    const updated = await this.repository.submitAttempt(attempt.id, answerGrades, attemptData);

    await auditLogService.record({
      action: 'ASSESSMENT_ATTEMPT_SUBMITTED',
      actorId: userId,
      ipAddress,
      metadata: { assessmentId, attemptId: attempt.id, userId, status: updated.status },
    });

    return this.toAttemptSummary(updated);
  }

  // ---------------------------------------------------------------------------------------
  // Trainer/Super-Admin-facing
  // ---------------------------------------------------------------------------------------

  async listAttempts(
    assessmentId: string,
    filters: AttemptListFilters,
    page: number,
    pageSize: number,
  ): Promise<PaginatedData<TrainerAttemptListItem>> {
    await this.findAssessmentOrThrow(assessmentId);

    const { items, total } = await this.repository.findAttemptsForAssessment(
      assessmentId,
      filters,
      (page - 1) * pageSize,
      pageSize,
    );

    return {
      items: items.map((attempt) => ({
        id: attempt.id,
        userId: attempt.userId,
        user: { firstName: attempt.user.firstName, lastName: attempt.user.lastName, email: attempt.user.email },
        status: attempt.status,
        submittedAt: attempt.submittedAt,
        totalScore: attempt.totalScore,
        percentage: attempt.percentage,
        passed: attempt.passed,
      })),
      meta: buildPaginationMeta(page, pageSize, total),
    };
  }

  async getAttemptDetail(assessmentId: string, attemptId: string) {
    const attempt = await this.repository.findAttemptDetail(attemptId);
    if (!attempt || attempt.assessmentId !== assessmentId) throw new NotFoundError('Attempt not found.');

    const answers = [...attempt.answers].sort((a, b) => a.assessmentQuestion.order - b.assessmentQuestion.order);

    return {
      id: attempt.id,
      assessmentId: attempt.assessmentId,
      userId: attempt.userId,
      user: attempt.user,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      gradedAt: attempt.gradedAt,
      timeSpentSeconds: attempt.timeSpentSeconds,
      autoScore: attempt.autoScore,
      manualScore: attempt.manualScore,
      totalScore: attempt.totalScore,
      percentage: attempt.percentage,
      passed: attempt.passed,
      answers: answers.map((answer) => ({
        id: answer.id,
        assessmentQuestionId: answer.assessmentQuestionId,
        question: {
          order: answer.assessmentQuestion.order,
          marks: answer.assessmentQuestion.marks,
          snapshotTitle: answer.assessmentQuestion.snapshotTitle,
          snapshotType: answer.assessmentQuestion.snapshotType,
          snapshotOptions: answer.assessmentQuestion.snapshotOptions,
          snapshotCorrectAnswers: answer.assessmentQuestion.snapshotCorrectAnswers,
          snapshotExplanation: answer.assessmentQuestion.snapshotExplanation,
          snapshotStarterCode: answer.assessmentQuestion.snapshotStarterCode,
          snapshotLanguage: answer.assessmentQuestion.snapshotLanguage,
        },
        selectedOptionIds: answer.selectedOptionIds,
        textAnswer: answer.textAnswer,
        fileRelativePath: answer.fileRelativePath,
        fileOriginalFilename: answer.fileOriginalFilename,
        isCorrect: answer.isCorrect,
        marksAwarded: answer.marksAwarded,
        gradedById: answer.gradedById,
        gradedAt: answer.gradedAt,
      })),
    };
  }

  async gradeAnswer(
    assessmentId: string,
    attemptId: string,
    answerId: string,
    dto: GradeAnswerDto,
    actorId: string,
    ipAddress?: string | null,
  ) {
    const attempt = await this.repository.findAttemptById(attemptId);
    if (!attempt || attempt.assessmentId !== assessmentId) throw new NotFoundError('Attempt not found.');

    const answer = await this.repository.findAnswerById(answerId);
    if (!answer || answer.attemptId !== attemptId) throw new NotFoundError('Answer not found.');

    if (!isManualReviewType(answer.assessmentQuestion.snapshotType)) {
      throw new BadRequestError(
        'Only manually-graded question types (SHORT_ANSWER, LONG_ANSWER, CODE_SNIPPET, FILE_UPLOAD) can be graded through this endpoint.',
      );
    }

    if (dto.marksAwarded > answer.assessmentQuestion.marks) {
      throw new BadRequestError(
        `marksAwarded cannot exceed this question's maximum of ${answer.assessmentQuestion.marks}.`,
      );
    }

    const assessment = await this.findAssessmentOrThrow(assessmentId);

    const now = new Date();
    const [questions, existingAnswers] = await Promise.all([
      this.repository.findAssessmentQuestions(assessmentId),
      this.repository.findAnswersByAttemptId(attemptId),
    ]);

    // Recompute the manual-score aggregate in-memory, applying this grade on top of the
    // pre-update snapshot — cheaper than a second DB round trip inside the transaction below,
    // and correct since nothing else can race the write we're about to make for this answerId.
    const answersByQuestionId = new Map(existingAnswers.map((row) => [row.assessmentQuestionId, row]));
    answersByQuestionId.set(answer.assessmentQuestionId, { ...answer, marksAwarded: dto.marksAwarded });

    let manualScore = 0;
    let allManualGraded = true;
    for (const question of questions) {
      if (!isManualReviewType(question.snapshotType)) continue;
      const row = answersByQuestionId.get(question.id);
      if (!row || row.marksAwarded === null || row.marksAwarded === undefined) {
        allManualGraded = false;
      } else {
        manualScore += row.marksAwarded;
      }
    }

    const autoScore = attempt.autoScore ?? 0;
    const maxMarks = questions.reduce((sum, question) => sum + question.marks, 0);
    const totalScore = autoScore + manualScore;
    const percentage = maxMarks === 0 ? 0 : Math.round((totalScore / maxMarks) * 100);

    const attemptData: Prisma.AssessmentAttemptUpdateInput = allManualGraded
      ? {
          manualScore,
          totalScore,
          percentage,
          passed: percentage >= assessment.passingPercentage,
          gradedAt: now,
          status: 'GRADED',
        }
      : { manualScore, totalScore: null, percentage: null, passed: null, status: 'PENDING_REVIEW' };

    const isCorrect = dto.isCorrect !== undefined ? dto.isCorrect : answer.isCorrect;
    const result = await this.repository.persistGrade(
      answerId,
      { marksAwarded: dto.marksAwarded, isCorrect, gradedById: actorId, gradedAt: now },
      attemptId,
      attemptData,
    );

    await auditLogService.record({
      action: 'ASSESSMENT_ANSWER_GRADED',
      actorId,
      ipAddress,
      metadata: { attemptId, answerId, marksAwarded: dto.marksAwarded },
    });

    return { attempt: this.toAttemptSummary(result.attempt), answer: result.answer };
  }

  // ---------------------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------------------

  /**
   * Shared by every trainee-facing method (Prompt 6 § RBAC ground rules — "Every trainee-facing
   * action must verify the assessment is actually accessible to them"): the assessment must be
   * PUBLISHED, not soft-deleted, and assigned (via group) to this trainee. Never leaks existence
   * — always a 403, never a 404, for an inaccessible or nonexistent assessment.
   */
  private async assertAssessmentAccessibleOrThrow(assessmentId: string, userId: string): Promise<Assessment> {
    const accessible = await this.repository.isAssessmentAccessibleToUser(assessmentId, userId);
    if (!accessible) throw new ForbiddenError("You don't have permission to access this assessment.");

    // Re-fetched rather than reused from the accessibility check above (which only `select`s
    // `id`) — always non-null here since `isAssessmentAccessibleToUser` just confirmed existence.
    const assessment = await this.repository.findAssessmentById(assessmentId);
    if (!assessment) throw new ForbiddenError("You don't have permission to access this assessment.");
    return assessment;
  }

  private async findOwnInProgressAttemptOrThrow(assessmentId: string, userId: string): Promise<AssessmentAttempt> {
    const attempt = await this.repository.findAttemptByAssessmentAndUser(assessmentId, userId);
    if (!attempt) throw new NotFoundError("You haven't started this assessment yet.");
    if (attempt.status !== 'IN_PROGRESS') {
      throw new ConflictError("This attempt is no longer in progress — answers can't be changed after submitting.");
    }
    return attempt;
  }

  private async findAssessmentQuestionOrThrow(assessmentId: string, assessmentQuestionId: string): Promise<AssessmentQuestion> {
    const question = await this.repository.findAssessmentQuestionById(assessmentQuestionId);
    if (!question || question.assessmentId !== assessmentId) {
      throw new NotFoundError('Question not found on this assessment.');
    }
    return question;
  }

  private async findAssessmentOrThrow(assessmentId: string): Promise<Assessment> {
    const assessment = await this.repository.findAssessmentById(assessmentId);
    if (!assessment) throw new NotFoundError('Assessment not found.');
    return assessment;
  }

  private async buildAttemptWithSanitizedQuestions(
    assessment: Assessment,
    attempt: AssessmentAttempt,
    preloadedQuestions?: AssessmentQuestion[],
  ): Promise<AttemptWithSanitizedQuestions> {
    const [questions, answers] = await Promise.all([
      preloadedQuestions ?? this.repository.findAssessmentQuestions(assessment.id),
      this.repository.findAnswersByAttemptId(attempt.id),
    ]);

    return {
      attempt: this.toAttemptSummary(attempt),
      questions: this.sanitizeQuestions(questions, attempt.questionOrder, answers),
    };
  }

  /** Applies `AssessmentAttempt.questionOrder` (when randomized) to a canonically-ordered question list. */
  private orderQuestions(questions: AssessmentQuestion[], questionOrder: unknown): AssessmentQuestion[] {
    if (!Array.isArray(questionOrder)) return questions;

    const byId = new Map(questions.map((question) => [question.id, question]));
    const ordered = (questionOrder as string[])
      .map((id) => byId.get(id))
      .filter((question): question is AssessmentQuestion => question !== undefined);

    const includedIds = new Set(ordered.map((question) => question.id));
    const remaining = questions.filter((question) => !includedIds.has(question.id));
    return [...ordered, ...remaining];
  }

  private sanitizeQuestions(
    questions: AssessmentQuestion[],
    questionOrder: unknown,
    answers: AssessmentAnswer[],
  ): SanitizedQuestionView[] {
    const ordered = this.orderQuestions(questions, questionOrder);
    const answersByQuestionId = new Map(answers.map((answer) => [answer.assessmentQuestionId, answer]));

    return ordered.map((question, index) => ({
      id: question.id,
      position: index + 1,
      marks: question.marks,
      snapshotTitle: question.snapshotTitle,
      snapshotType: question.snapshotType,
      snapshotOptions: this.sanitizeOptions(question.snapshotOptions),
      snapshotStarterCode: question.snapshotStarterCode,
      snapshotLanguage: question.snapshotLanguage,
      savedAnswer: this.toSavedAnswerViewOrNull(answersByQuestionId.get(question.id)),
    }));
  }

  private buildGradedQuestions(
    questions: AssessmentQuestion[],
    questionOrder: unknown,
    answers: AssessmentAnswer[],
  ): GradedQuestionView[] {
    const ordered = this.orderQuestions(questions, questionOrder);
    const answersByQuestionId = new Map(answers.map((answer) => [answer.assessmentQuestionId, answer]));

    return ordered.map((question, index) => {
      const answer = answersByQuestionId.get(question.id);
      return {
        id: question.id,
        position: index + 1,
        marks: question.marks,
        snapshotTitle: question.snapshotTitle,
        snapshotType: question.snapshotType,
        // Un-sanitized (isCorrect intentionally left in) — results are authorized to be revealed
        // at this point, unlike sanitizeQuestions()'s pre-grading view.
        snapshotOptions: (question.snapshotOptions as unknown as SnapshotOption[] | null) ?? null,
        snapshotCorrectAnswers: question.snapshotCorrectAnswers,
        snapshotExplanation: question.snapshotExplanation,
        snapshotStarterCode: question.snapshotStarterCode,
        snapshotLanguage: question.snapshotLanguage,
        yourAnswer: this.toSavedAnswerViewOrNull(answer),
        isCorrect: answer?.isCorrect ?? null,
        marksAwarded: answer?.marksAwarded ?? null,
      };
    });
  }

  private sanitizeOptions(options: unknown): SanitizedQuestionView['snapshotOptions'] {
    if (!Array.isArray(options)) return null;
    return (options as SnapshotOption[])
      .map(({ id, text, order }) => ({ id, text, order }))
      .sort((a, b) => a.order - b.order);
  }

  private toSavedAnswerViewOrNull(answer: AssessmentAnswer | undefined): SavedAnswerView | null {
    if (!answer) return null;
    return this.toSavedAnswerView(answer);
  }

  private toSavedAnswerView(answer: AssessmentAnswer): SavedAnswerView {
    return {
      selectedOptionIds: (answer.selectedOptionIds as unknown as string[] | null) ?? null,
      textAnswer: answer.textAnswer,
      fileOriginalFilename: answer.fileOriginalFilename,
    };
  }

  private toAttemptSummary(attempt: AssessmentAttempt): AttemptSummary {
    return {
      id: attempt.id,
      assessmentId: attempt.assessmentId,
      userId: attempt.userId,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      gradedAt: attempt.gradedAt,
      timeSpentSeconds: attempt.timeSpentSeconds,
      totalScore: attempt.totalScore,
      percentage: attempt.percentage,
      passed: attempt.passed,
    };
  }

  /** SINGLE_CORRECT_MCQ/MULTIPLE_CORRECT/TRUE_FALSE: set-compare. FILL_IN_THE_BLANK/SQL_QUERY: normalized-text-compare. */
  private isAutoGradedAnswerCorrect(question: AssessmentQuestion, existing: AssessmentAnswer | undefined): boolean {
    if (isOptionBasedType(question.snapshotType)) {
      const correctIds = new Set(
        ((question.snapshotOptions as unknown as SnapshotOption[] | null) ?? [])
          .filter((option) => option.isCorrect)
          .map((option) => option.id),
      );
      const selectedIds = new Set((existing?.selectedOptionIds as unknown as string[] | null) ?? []);
      return setsEqual(selectedIds, correctIds);
    }

    if (isAutoGradableTextType(question.snapshotType)) {
      const submitted = existing?.textAnswer;
      if (submitted === null || submitted === undefined) return false;
      const normalizedSubmitted = normalizeText(submitted);
      const acceptable = ((question.snapshotCorrectAnswers as unknown as string[] | null) ?? []).map(normalizeText);
      return acceptable.includes(normalizedSubmitted);
    }

    return false;
  }

  private assertAcceptedMimeType(mimeType: string): void {
    if (!(ACCEPTED_LESSON_MIME_TYPES as readonly string[]).includes(mimeType)) {
      throw new BadRequestError(`Unsupported file type: ${mimeType}.`);
    }
  }

  private assertFileSizeWithinLimit(sizeBytes: number): void {
    if (sizeBytes > MAX_LESSON_FILE_SIZE_BYTES) {
      throw new BadRequestError(`File exceeds the maximum allowed size of ${MAX_LESSON_FILE_SIZE_BYTES} bytes.`);
    }
  }
}
