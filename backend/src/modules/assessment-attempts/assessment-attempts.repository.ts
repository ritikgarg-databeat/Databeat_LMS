import { Prisma, type AssessmentAttemptStatus } from '@prisma/client';

import { activeGroupMembershipWhere } from '@/policies/group-access.policy';
import { trainerAssessmentScope } from '@/policies/trainer-scope.policy';
import { BaseRepository } from '@/repositories/base.repository';

export interface AttemptListFilters {
  status?: AssessmentAttemptStatus;
}

/**
 * Domain-level (not raw Prisma) shape for upserting an answer's actual content — every call site
 * sets all four fields at once (see assessment-attempts.service.ts#saveAnswer/#uploadAnswer), so
 * this stays simpler than threading Prisma's `JsonNull` sentinel through the service layer;
 * `upsertAnswer` below is the one place that translates `selectedOptionIds: null` into it.
 */
export interface AnswerContentInput {
  selectedOptionIds: string[] | null;
  textAnswer: string | null;
  fileRelativePath: string | null;
  fileOriginalFilename: string | null;
}

export interface AnswerGradeUpsert {
  assessmentQuestionId: string;
  isCorrect: boolean | null;
  marksAwarded: number | null;
}

export interface PersistGradeAnswerInput {
  marksAwarded: number;
  isCorrect: boolean | null;
  gradedById: string;
  gradedAt: Date;
}

const attemptListInclude = {
  user: { select: { firstName: true, lastName: true, email: true } },
} satisfies Prisma.AssessmentAttemptInclude;

const attemptDetailInclude = {
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
  answers: { include: { assessmentQuestion: true } },
} satisfies Prisma.AssessmentAttemptInclude;

export type AttemptListRow = Prisma.AssessmentAttemptGetPayload<{ include: typeof attemptListInclude }>;
export type AttemptDetailRow = Prisma.AssessmentAttemptGetPayload<{ include: typeof attemptDetailInclude }>;

function buildAttemptWhere(assessmentId: string, filters: AttemptListFilters): Prisma.AssessmentAttemptWhereInput {
  const where: Prisma.AssessmentAttemptWhereInput = { assessmentId };
  if (filters.status) where.status = filters.status;
  return where;
}

// Data-access layer for the assessment-attempts module. Only this class may query Prisma
// directly (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly.
// This module works directly against Assessment/AssessmentQuestion/AssessmentGroupAssignment/
// Group/GroupMember for its own self-contained accessibility check, and owns
// AssessmentAttempt/AssessmentAnswer exclusively — it deliberately does not import from the
// assessments module (feature-local duplication over premature cross-module coupling, mirroring
// the resources/progress modules' precedent from Prompt 5 — see README.md).
export class AssessmentAttemptsRepository extends BaseRepository {
  findAssessmentById(assessmentId: string) {
    return this.db.assessment.findFirst({ where: { id: assessmentId, deletedAt: null } });
  }

  /**
   * Self-contained copy of `CoursesRepository#isAccessibleToUser` (Prompt 5 precedent),
   * replicated against Assessment/AssessmentGroupAssignment/Group/GroupMember instead of
   * Course/CourseGroupAssignment: an assessment is accessible to `userId` iff it is PUBLISHED,
   * not soft-deleted, and assigned to a group the user is a member of.
   */
  async isAssessmentAccessibleToUser(assessmentId: string, userId: string): Promise<boolean> {
    const assessment = await this.db.assessment.findFirst({
      where: { id: assessmentId, status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
    if (!assessment) return false;

    const membership = await this.db.groupMember.findFirst({
      where: activeGroupMembershipWhere(userId, {
        assessmentGroupAssignments: { some: { assessmentId } },
      }),
    });
    return membership !== null;
  }

  async isAssessmentInTrainerScope(assessmentId: string, trainerId: string): Promise<boolean> {
    const assessment = await this.db.assessment.findFirst({
      where: {
        id: assessmentId,
        deletedAt: null,
        ...trainerAssessmentScope(trainerId),
      },
      select: { id: true },
    });
    return assessment !== null;
  }

  findAssessmentQuestions(assessmentId: string) {
    return this.db.assessmentQuestion.findMany({ where: { assessmentId }, orderBy: { order: 'asc' } });
  }

  findAssessmentQuestionById(assessmentQuestionId: string) {
    return this.db.assessmentQuestion.findUnique({ where: { id: assessmentQuestionId } });
  }

  findAttemptByAssessmentAndUser(assessmentId: string, userId: string) {
    return this.db.assessmentAttempt.findUnique({ where: { assessmentId_userId: { assessmentId, userId } } });
  }

  findAttemptById(attemptId: string) {
    return this.db.assessmentAttempt.findUnique({ where: { id: attemptId } });
  }

  /** Bounded work queue for the scheduler; oldest expiries are finalized first. */
  findExpiredInProgressAttempts(expiresAtOrBefore: Date, take: number) {
    return this.db.assessmentAttempt.findMany({
      where: { status: 'IN_PROGRESS', expiresAt: { lte: expiresAtOrBefore } },
      orderBy: { expiresAt: 'asc' },
      take,
      include: { assessment: true },
    });
  }

  createAttempt(data: Prisma.AssessmentAttemptCreateInput) {
    return this.db.assessmentAttempt.create({ data });
  }

  findAnswersByAttemptId(attemptId: string) {
    return this.db.assessmentAnswer.findMany({ where: { attemptId } });
  }

  findAnswerByAttemptAndQuestion(attemptId: string, assessmentQuestionId: string) {
    return this.db.assessmentAnswer.findUnique({
      where: { attemptId_assessmentQuestionId: { attemptId, assessmentQuestionId } },
    });
  }

  findAnswerById(answerId: string) {
    return this.db.assessmentAnswer.findUnique({
      where: { id: answerId },
      include: { assessmentQuestion: true },
    });
  }

  upsertAnswer(attemptId: string, assessmentQuestionId: string, data: AnswerContentInput) {
    const { selectedOptionIds, ...rest } = data;
    const selectedOptionIdsJson = selectedOptionIds === null ? Prisma.JsonNull : selectedOptionIds;

    return this.db.assessmentAnswer.upsert({
      where: { attemptId_assessmentQuestionId: { attemptId, assessmentQuestionId } },
      create: { attemptId, assessmentQuestionId, selectedOptionIds: selectedOptionIdsJson, ...rest },
      update: { selectedOptionIds: selectedOptionIdsJson, ...rest },
    });
  }

  /**
   * Persists the whole auto-grading pass atomically (Prompt 6 § `POST /mine/submit` — "Wrap the
   * whole grading+update sequence in a $transaction"): upserts every auto-graded (or previously
   * unanswered) AssessmentAnswer's grading fields — see assessment-attempts.service.ts#submit for
   * how `answerGrades` is computed — then finalizes the attempt row in the same transaction.
   */
  async submitAttempt(
    attemptId: string,
    answerGrades: AnswerGradeUpsert[],
    attemptData: Prisma.AssessmentAttemptUpdateInput,
  ) {
    return this.db.$transaction(async (tx) => {
      for (const grade of answerGrades) {
        await tx.assessmentAnswer.upsert({
          where: { attemptId_assessmentQuestionId: { attemptId, assessmentQuestionId: grade.assessmentQuestionId } },
          create: {
            attemptId,
            assessmentQuestionId: grade.assessmentQuestionId,
            isCorrect: grade.isCorrect,
            marksAwarded: grade.marksAwarded,
          },
          update: { isCorrect: grade.isCorrect, marksAwarded: grade.marksAwarded },
        });
      }
      return tx.assessmentAttempt.update({ where: { id: attemptId }, data: attemptData });
    });
  }

  /** Persists a manual grade + the recomputed attempt aggregate atomically (endpoint 8). */
  async persistGrade(
    answerId: string,
    answerData: PersistGradeAnswerInput,
    attemptId: string,
    attemptData: Prisma.AssessmentAttemptUpdateInput,
  ) {
    return this.db.$transaction(async (tx) => {
      const answer = await tx.assessmentAnswer.update({ where: { id: answerId }, data: answerData });
      const attempt = await tx.assessmentAttempt.update({ where: { id: attemptId }, data: attemptData });
      return { attempt, answer };
    });
  }

  async findAttemptsForAssessment(assessmentId: string, filters: AttemptListFilters, skip: number, take: number) {
    const where = buildAttemptWhere(assessmentId, filters);
    const [items, total] = await Promise.all([
      this.db.assessmentAttempt.findMany({
        where,
        skip,
        take,
        orderBy: { submittedAt: 'desc' },
        include: attemptListInclude,
      }),
      this.db.assessmentAttempt.count({ where }),
    ]);
    return { items, total };
  }

  findAttemptDetail(attemptId: string) {
    return this.db.assessmentAttempt.findUnique({ where: { id: attemptId }, include: attemptDetailInclude });
  }
}
