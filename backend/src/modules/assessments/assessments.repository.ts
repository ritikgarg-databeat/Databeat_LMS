import type { AssessmentStatus, Prisma } from '@prisma/client';

import { BaseRepository } from '@/repositories/base.repository';

import type { AssessmentListFilters, AssessmentSortField, SortOrder } from './assessments.types';

function buildWhere(filters: AssessmentListFilters): Prisma.AssessmentWhereInput {
  const where: Prisma.AssessmentWhereInput = { deletedAt: null };

  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.title = { contains: filters.search, mode: 'insensitive' };
  }

  return where;
}

const listInclude = {
  _count: { select: { groupAssignments: true, questions: true, attempts: true } },
} satisfies Prisma.AssessmentInclude;

const detailInclude = {
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  _count: { select: { questions: true } },
  groupAssignments: {
    include: { group: { select: { id: true, name: true, code: true } } },
  },
} satisfies Prisma.AssessmentInclude;

// `questions` here is a minimal projection used only to sum marks in the service layer — there
// is no stored `maxMarks` field (Prompt 6 § schema comment on Assessment.maxMarks).
const learnerInclude = {
  _count: { select: { questions: true } },
  questions: { select: { marks: true } },
} satisfies Prisma.AssessmentInclude;

export type AssessmentListItem = Prisma.AssessmentGetPayload<{ include: typeof listInclude }>;
export type AssessmentDetail = Prisma.AssessmentGetPayload<{ include: typeof detailInclude }>;
export type AssessmentForLearner = Prisma.AssessmentGetPayload<{ include: typeof learnerInclude }>;

// Data-access layer for the assessments module. Only this class may query Prisma directly
// (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly.
export class AssessmentsRepository extends BaseRepository {
  async findMany(
    filters: AssessmentListFilters,
    skip: number,
    take: number,
    sortBy: AssessmentSortField = 'createdAt',
    sortOrder: SortOrder = 'desc',
  ) {
    const where = buildWhere(filters);
    const [items, total] = await Promise.all([
      this.db.assessment.findMany({ where, skip, take, orderBy: { [sortBy]: sortOrder }, include: listInclude }),
      this.db.assessment.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string) {
    return this.db.assessment.findFirst({ where: { id, deletedAt: null } });
  }

  findDetailById(id: string) {
    return this.db.assessment.findFirst({ where: { id, deletedAt: null }, include: detailInclude });
  }

  create(data: Prisma.AssessmentCreateInput) {
    return this.db.assessment.create({ data });
  }

  update(id: string, data: Prisma.AssessmentUpdateInput) {
    return this.db.assessment.update({ where: { id }, data });
  }

  softDelete(id: string) {
    return this.db.assessment.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * Deep-copies an assessment's question snapshots inside a single transaction so the
   * duplicate is never left partially created. Copies the existing AssessmentQuestion snapshot
   * fields verbatim (does NOT re-snapshot from the live bank question) and deliberately does
   * NOT copy AssessmentGroupAssignment or AssessmentAttempt rows — a duplicate starts unassigned
   * with no attempt history (mirrors CoursesRepository#duplicate's precedent, Prompt 5).
   */
  async duplicate(sourceId: string, title: string, actorId: string) {
    return this.db.$transaction(async (tx) => {
      const source = await tx.assessment.findFirstOrThrow({
        where: { id: sourceId, deletedAt: null },
        include: { questions: { orderBy: { order: 'asc' } } },
      });

      const created = await tx.assessment.create({
        data: {
          title,
          description: source.description,
          durationMinutes: source.durationMinutes,
          passingPercentage: source.passingPercentage,
          availableFrom: source.availableFrom,
          dueDate: source.dueDate,
          instructions: source.instructions,
          negativeMarkingEnabled: source.negativeMarkingEnabled,
          negativeMarksPerWrongAnswer: source.negativeMarksPerWrongAnswer,
          randomizeQuestions: source.randomizeQuestions,
          showResultImmediately: source.showResultImmediately,
          status: 'DRAFT',
          createdById: actorId,
        },
      });

      for (const sourceQuestion of source.questions) {
        await tx.assessmentQuestion.create({
          data: {
            assessmentId: created.id,
            questionId: sourceQuestion.questionId,
            order: sourceQuestion.order,
            marks: sourceQuestion.marks,
            snapshotTitle: sourceQuestion.snapshotTitle,
            snapshotType: sourceQuestion.snapshotType,
            snapshotExplanation: sourceQuestion.snapshotExplanation,
            snapshotOptions: sourceQuestion.snapshotOptions ?? undefined,
            snapshotCorrectAnswers: sourceQuestion.snapshotCorrectAnswers ?? undefined,
            snapshotStarterCode: sourceQuestion.snapshotStarterCode,
            snapshotLanguage: sourceQuestion.snapshotLanguage,
          },
        });
      }

      return tx.assessment.findUniqueOrThrow({ where: { id: created.id } });
    });
  }

  countAll() {
    return this.db.assessment.count({ where: { deletedAt: null } });
  }

  countByStatus(status: AssessmentStatus) {
    return this.db.assessment.count({ where: { deletedAt: null, status } });
  }

  countPendingGrading() {
    return this.db.assessmentAttempt.count({ where: { status: 'PENDING_REVIEW' } });
  }

  /** PUBLISHED, non-deleted assessments whose due-date window is still open (or has none). */
  countUpcoming() {
    const now = new Date();
    return this.db.assessment.count({
      where: { status: 'PUBLISHED', deletedAt: null, OR: [{ dueDate: null }, { dueDate: { gt: now } }] },
    });
  }

  listAssignments(assessmentId: string) {
    return this.db.assessmentGroupAssignment.findMany({
      where: { assessmentId },
      orderBy: { assignedAt: 'desc' },
      include: { group: { select: { id: true, name: true, code: true, _count: { select: { members: true } } } } },
    });
  }

  findAssignment(assessmentId: string, groupId: string) {
    return this.db.assessmentGroupAssignment.findUnique({ where: { assessmentId_groupId: { assessmentId, groupId } } });
  }

  createAssignment(assessmentId: string, groupId: string, assignedById: string) {
    return this.db.assessmentGroupAssignment.create({ data: { assessmentId, groupId, assignedById } });
  }

  deleteAssignment(assessmentId: string, groupId: string) {
    return this.db.assessmentGroupAssignment.delete({ where: { assessmentId_groupId: { assessmentId, groupId } } });
  }

  /** userIds of every member of `groupId` — used to fan out the ASSESSMENT_ASSIGNED notification. */
  async findGroupMemberUserIds(groupId: string): Promise<string[]> {
    const members = await this.db.groupMember.findMany({ where: { groupId }, select: { userId: true } });
    return members.map((member) => member.userId);
  }

  /** Distinct assessment ids assigned (via group membership) to `userId` that are currently published. */
  async findAssignedAssessmentIds(userId: string): Promise<string[]> {
    const memberships = await this.db.groupMember.findMany({ where: { userId }, select: { groupId: true } });
    if (memberships.length === 0) return [];

    const groupIds = memberships.map((membership) => membership.groupId);
    const assignments = await this.db.assessmentGroupAssignment.findMany({
      where: { groupId: { in: groupIds }, assessment: { status: 'PUBLISHED', deletedAt: null } },
      distinct: ['assessmentId'],
      select: { assessmentId: true },
    });
    return assignments.map((assignment) => assignment.assessmentId);
  }

  findManyForLearner(assessmentIds: string[]) {
    return this.db.assessment.findMany({ where: { id: { in: assessmentIds } }, include: learnerInclude });
  }

  /** The current user's own attempt summary per assessment, keyed by assessmentId by the caller. */
  findAttemptsForUser(userId: string, assessmentIds: string[]) {
    return this.db.assessmentAttempt.findMany({
      where: { userId, assessmentId: { in: assessmentIds } },
      select: { assessmentId: true, status: true, percentage: true, passed: true, submittedAt: true },
    });
  }

  listQuestions(assessmentId: string) {
    return this.db.assessmentQuestion.findMany({ where: { assessmentId }, orderBy: { order: 'asc' } });
  }

  findQuestion(assessmentId: string, assessmentQuestionId: string) {
    return this.db.assessmentQuestion.findFirst({ where: { id: assessmentQuestionId, assessmentId } });
  }

  countQuestions(assessmentId: string) {
    return this.db.assessmentQuestion.count({ where: { assessmentId } });
  }

  /** Used to block deleting a question once real attempts exist (see removeQuestion's guard). */
  countAttempts(assessmentId: string) {
    return this.db.assessmentAttempt.count({ where: { assessmentId } });
  }

  async findNextOrder(assessmentId: string): Promise<number> {
    const top = await this.db.assessmentQuestion.findFirst({
      where: { assessmentId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return top ? top.order + 1 : 0;
  }

  createQuestion(data: Prisma.AssessmentQuestionCreateInput) {
    return this.db.assessmentQuestion.create({ data });
  }

  updateQuestionMarks(assessmentQuestionId: string, marks: number) {
    return this.db.assessmentQuestion.update({ where: { id: assessmentQuestionId }, data: { marks } });
  }

  deleteQuestion(assessmentQuestionId: string) {
    return this.db.assessmentQuestion.delete({ where: { id: assessmentQuestionId } });
  }

  async sumMarks(assessmentId: string): Promise<number> {
    const result = await this.db.assessmentQuestion.aggregate({ where: { assessmentId }, _sum: { marks: true } });
    return result._sum.marks ?? 0;
  }

  /**
   * Two-phase update to avoid tripping the `@@unique([assessmentId, order])` constraint:
   * writing final 0..N-1 values one row at a time could collide with another row's
   * not-yet-updated `order` (e.g. swapping the first two rows). Every row belonging to this
   * assessment is first moved to a distinct, guaranteed-unused negative placeholder, then all
   * rows are set to their final order — callers must have already validated that `orderedIds`
   * is the complete, exact set of this assessment's AssessmentQuestion ids (see
   * AssessmentsService#reorderQuestions) so this two-phase approach can never collide with an
   * untouched sibling.
   */
  async reorderQuestions(orderedIds: string[]): Promise<void> {
    await this.db.$transaction(async (tx) => {
      for (let index = 0; index < orderedIds.length; index += 1) {
        await tx.assessmentQuestion.update({ where: { id: orderedIds[index] }, data: { order: -(index + 1) } });
      }
      for (let index = 0; index < orderedIds.length; index += 1) {
        await tx.assessmentQuestion.update({ where: { id: orderedIds[index] }, data: { order: index } });
      }
    });
  }

  /**
   * Shared access-check rule (Prompt 6 § SECURITY), consumed by the assessment-attempts module
   * (a self-contained copy, per this codebase's feature-local-duplication convention — see
   * README.md) — keep this name and signature stable. An assessment is accessible to `userId`
   * if it is published, not deleted, and assigned to a group the user is a member of. Mirrors
   * `CoursesRepository.isAccessibleToUser`'s exact shape (courses.repository.ts).
   */
  async isAccessibleToUser(assessmentId: string, userId: string): Promise<boolean> {
    const assessment = await this.db.assessment.findFirst({
      where: { id: assessmentId, status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
    if (!assessment) return false;

    const membership = await this.db.groupMember.findFirst({
      where: { userId, group: { assessmentGroupAssignments: { some: { assessmentId } } } },
    });
    return membership !== null;
  }
}
