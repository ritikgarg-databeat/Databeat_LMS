import type { LessonProgressStatus, Prisma, UserPerformanceSnapshot } from '@prisma/client';

import { activeGroupScope } from '@/policies/group-access.policy';
import { BaseRepository } from '@/repositories/base.repository';

import type { AssessmentQuestionStat, AssessmentWeakTopic, LessonFunnelStep } from './analytics.types';

/** Single cast point for writing this module's typed shapes into Prisma Json columns. */
const toJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

/** UserDailyActivity's count columns, sans identity — the unit both bucketing and timelines use. */
export interface DailyActivityCounts {
  logins: number;
  lessonsCompleted: number;
  assessmentsSubmitted: number;
  aiMessages: number;
  qnaPosts: number;
}

export interface NewDailyActivityRow extends DailyActivityCounts {
  /** UTC midnight (what the `@db.Date` column stores). */
  date: Date;
}

export interface DailyActivityRow extends DailyActivityCounts {
  userId: string;
  date: Date;
}

export interface UserLessonProgressRow {
  lessonId: string;
  status: LessonProgressStatus;
  timeSpentSeconds: number;
}

export interface CourseLessonProgressRow extends UserLessonProgressRow {
  userId: string;
}

export interface UserSnapshotData {
  coursesAssigned: number;
  coursesCompleted: number;
  lessonsCompleted: number;
  totalAssignedLessons: number;
  completionPercentage: number;
  timeSpentSeconds: number;
  assessmentsAssigned: number;
  assessmentsTaken: number;
  assessmentsPassed: number;
  averageScore: number | null;
  activityEvents7d: number;
  performanceScore: number;
  lastActivityAt: Date | null;
}

export interface CourseSnapshotData {
  assignedTrainees: number;
  startedCount: number;
  completedCount: number;
  completionRate: number;
  averageTimeSpentSeconds: number;
  averageScore: number | null;
  lessonFunnel: LessonFunnelStep[];
}

export interface AssessmentSnapshotData {
  assignedTrainees: number;
  attemptedCount: number;
  submittedCount: number;
  gradedCount: number;
  participationRate: number;
  averageScore: number | null;
  passRate: number;
  questionStats: AssessmentQuestionStat[];
  weakTopics: AssessmentWeakTopic[];
}

export interface LeaderboardPopulationCriteria {
  /**
   * TRAINER caller: restrict to members of these (their) groups. Undefined (SUPER_ADMIN):
   * population is all ACTIVE trainees instead.
   */
  trainerGroupIds?: string[];
  groupId?: string;
  departmentId?: string;
  courseId?: string;
}

// Data-access layer for the analytics module. Only this class may query Prisma directly (see
// ARCHITECTURE.md §3.1) — both analytics.service.ts and aggregation.service.ts go through it.
// Like the progress module, it works directly against the transactional models it aggregates
// (Course/Lesson/LessonProgress/Assessment*/GroupMember/AuditLog/Ai*/Qna*) and deliberately
// does not import from those feature modules.
export class AnalyticsRepository extends BaseRepository {
  // --- Security helpers (see analytics.service.ts / README.md § Security model) -------------

  /**
   * Groups this trainer is assigned to (Group.trainerId). ARCHIVED groups are deliberately
   * included — analytics may cover archived batches — but soft-deleted groups are not
   * (deletedAt means "removed from normal views", the Prompt 4 precedent).
   */
  async findTrainerGroupIds(trainerId: string): Promise<string[]> {
    const groups = await this.db.group.findMany({
      where: { trainerId, deletedAt: null },
      select: { id: true },
    });
    return groups.map((group) => group.id);
  }

  /** A trainee is visible to a trainer iff they belong to any group the trainer is assigned to. */
  async isTraineeVisibleToTrainer(traineeId: string, trainerId: string): Promise<boolean> {
    const membership = await this.db.groupMember.findFirst({
      where: { userId: traineeId, group: { trainerId, deletedAt: null } },
      select: { id: true },
    });
    return membership !== null;
  }

  // --- Groups --------------------------------------------------------------------------------

  findGroupsWithTraineeMembers(filters: { trainerId?: string; departmentId?: string }) {
    return this.db.group.findMany({
      where: {
        deletedAt: null,
        ...(filters.trainerId ? { trainerId: filters.trainerId } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        department: { select: { name: true } },
        members: { where: { user: { role: 'TRAINEE' } }, select: { userId: true } },
      },
    });
  }

  findGroupDetail(groupId: string) {
    return this.db.group.findFirst({
      where: { id: groupId, deletedAt: null },
      select: {
        id: true,
        name: true,
        code: true,
        trainerId: true,
        department: { select: { name: true } },
        members: {
          where: { user: { role: 'TRAINEE' } },
          select: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
      },
    });
  }

  // --- Users ---------------------------------------------------------------------------------

  findUserById(userId: string) {
    return this.db.user.findUnique({ where: { id: userId }, select: { id: true, lastLogin: true } });
  }

  findUserWithGroups(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        lastLogin: true,
        department: { select: { name: true } },
        groupMemberships: { select: { group: { select: { name: true } } } },
      },
    });
  }

  async findActiveTraineeIds(): Promise<string[]> {
    const users = await this.db.user.findMany({
      where: { role: 'TRAINEE', isActive: true },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  findLeaderboardPopulation(criteria: LeaderboardPopulationCriteria) {
    // Membership constraints are AND-ed (a user must satisfy every one), so they can't be
    // object-spread into a single `groupMemberships` key that would silently overwrite.
    const membershipConditions: Prisma.UserWhereInput[] = [];
    if (criteria.trainerGroupIds) {
      membershipConditions.push({
        groupMemberships: { some: { groupId: { in: criteria.trainerGroupIds } } },
      });
    }
    if (criteria.groupId) {
      membershipConditions.push({ groupMemberships: { some: { groupId: criteria.groupId } } });
    }
    if (criteria.courseId) {
      membershipConditions.push({
        groupMemberships: {
          some: { group: { courseAssignments: { some: { courseId: criteria.courseId } } } },
        },
      });
    }

    return this.db.user.findMany({
      where: {
        role: 'TRAINEE',
        ...(criteria.trainerGroupIds ? {} : { isActive: true }),
        ...(criteria.departmentId ? { departmentId: criteria.departmentId } : {}),
        AND: membershipConditions,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        groupMemberships: { select: { group: { select: { name: true } } } },
      },
    });
  }

  // --- UserDailyActivity (cache table) ---------------------------------------------------------

  async findLatestDailyActivityComputedAt(userId: string): Promise<Date | null> {
    const row = await this.db.userDailyActivity.findFirst({
      where: { userId },
      orderBy: { computedAt: 'desc' },
      select: { computedAt: true },
    });
    return row?.computedAt ?? null;
  }

  /**
   * Idempotent window rewrite: delete the range then re-insert, in one transaction.
   * `skipDuplicates` guards the rare race where two concurrent recomputes interleave — both
   * derive identical rows from the same immutable sources, so keeping either write is correct.
   */
  replaceDailyActivity(userId: string, windowStart: Date, rows: NewDailyActivityRow[]) {
    return this.db.$transaction([
      this.db.userDailyActivity.deleteMany({ where: { userId, date: { gte: windowStart } } }),
      this.db.userDailyActivity.createMany({
        data: rows.map((row) => ({ userId, ...row })),
        skipDuplicates: true,
      }),
    ]);
  }

  async findDailyActivityForUsers(userIds: string[], since: Date): Promise<DailyActivityRow[]> {
    if (!userIds.length) return [];
    return this.db.userDailyActivity.findMany({
      where: { userId: { in: userIds }, date: { gte: since } },
      select: {
        userId: true,
        date: true,
        logins: true,
        lessonsCompleted: true,
        assessmentsSubmitted: true,
        aiMessages: true,
        qnaPosts: true,
      },
    });
  }

  /** Sum of every count column over the user's daily-activity rows since `since` (inclusive). */
  async sumDailyActivitySince(userId: string, since: Date): Promise<number> {
    const result = await this.db.userDailyActivity.aggregate({
      where: { userId, date: { gte: since } },
      _sum: {
        logins: true,
        lessonsCompleted: true,
        assessmentsSubmitted: true,
        aiMessages: true,
        qnaPosts: true,
      },
    });
    const sums = result._sum;
    return (
      (sums.logins ?? 0) +
      (sums.lessonsCompleted ?? 0) +
      (sums.assessmentsSubmitted ?? 0) +
      (sums.aiMessages ?? 0) +
      (sums.qnaPosts ?? 0)
    );
  }

  // --- Daily-activity sources (immutable transactional timestamps) ----------------------------

  async findLoginTimestamps(userId: string, since: Date): Promise<Date[]> {
    const rows = await this.db.auditLog.findMany({
      where: { action: 'LOGIN_SUCCESS', actorId: userId, createdAt: { gte: since } },
      select: { createdAt: true },
    });
    return rows.map((row) => row.createdAt);
  }

  async findLessonCompletionTimestamps(userId: string, since: Date): Promise<Date[]> {
    const rows = await this.db.lessonProgress.findMany({
      where: { userId, completedAt: { gte: since } },
      select: { completedAt: true },
    });
    return rows.flatMap((row) => (row.completedAt ? [row.completedAt] : []));
  }

  async findAssessmentSubmissionTimestamps(userId: string, since: Date): Promise<Date[]> {
    const rows = await this.db.assessmentAttempt.findMany({
      where: { userId, submittedAt: { gte: since } },
      select: { submittedAt: true },
    });
    return rows.flatMap((row) => (row.submittedAt ? [row.submittedAt] : []));
  }

  /** Every message in the user's conversations (both USER and ASSISTANT turns, per the schema doc). */
  async findAiMessageTimestamps(userId: string, since: Date): Promise<Date[]> {
    const rows = await this.db.aiMessage.findMany({
      where: { conversation: { userId }, createdAt: { gte: since } },
      select: { createdAt: true },
    });
    return rows.map((row) => row.createdAt);
  }

  /**
   * Question/answer/comment posts authored by the user. Soft-deleted posts still count — the
   * posting activity happened, and counting immutable createdAt timestamps regardless of later
   * deletion keeps window recomputes idempotent.
   */
  async findQnaPostTimestamps(userId: string, since: Date): Promise<Date[]> {
    const [questions, answers, comments] = await Promise.all([
      this.db.qnaQuestion.findMany({
        where: { authorId: userId, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.db.qnaAnswer.findMany({
        where: { authorId: userId, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      this.db.qnaComment.findMany({
        where: { authorId: userId, createdAt: { gte: since } },
        select: { createdAt: true },
      }),
    ]);
    return [...questions, ...answers, ...comments].map((row) => row.createdAt);
  }

  // --- Classroom (courses/lessons/progress) ----------------------------------------------------

  /**
   * Feature-local copy of the classroom accessibility rule: a course is accessible to a user
   * iff it's PUBLISHED, not soft-deleted, and assigned to a group the user belongs to.
   * Reference copy: progress.repository.ts#findAccessibleCourseIds (kept in sync by
   * convention — analytics deliberately does not import from the progress module).
   */
  findAccessibleCourses(userId: string) {
    return this.db.course.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        groupAssignments: { some: { group: activeGroupScope({ members: { some: { userId } } }) } },
      },
      select: { id: true, title: true },
    });
  }

  /** Dashboard-oriented shape: accessible courses, published lessons, and this user's progress in one round trip. */
  findAccessibleCoursesWithProgress(userId: string) {
    return this.db.course.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        groupAssignments: { some: { group: activeGroupScope({ members: { some: { userId } } }) } },
      },
      select: {
        id: true,
        title: true,
        modules: {
          where: { isPublished: true },
          select: {
            lessons: {
              where: { isPublished: true },
              select: {
                id: true,
                progress: {
                  where: { userId },
                  take: 1,
                  select: { status: true, timeSpentSeconds: true },
                },
              },
            },
          },
        },
      },
    });
  }

  /** Published lessons in published modules of the given courses, tagged with their courseId. */
  async findPublishedLessonRefsForCourses(courseIds: string[]): Promise<{ id: string; courseId: string }[]> {
    if (!courseIds.length) return [];
    const lessons = await this.db.lesson.findMany({
      where: { isPublished: true, module: { isPublished: true, courseId: { in: courseIds } } },
      select: { id: true, module: { select: { courseId: true } } },
    });
    return lessons.map((lesson) => ({ id: lesson.id, courseId: lesson.module.courseId }));
  }

  async findLessonProgressRows(userId: string, lessonIds: string[]): Promise<UserLessonProgressRow[]> {
    if (!lessonIds.length) return [];
    return this.db.lessonProgress.findMany({
      where: { userId, lessonId: { in: lessonIds } },
      select: { lessonId: true, status: true, timeSpentSeconds: true },
    });
  }

  /** Sum over ALL of the user's LessonProgress rows — mirrors progress.repository#sumTimeSpentForUser. */
  async sumTimeSpentForUser(userId: string): Promise<number> {
    const result = await this.db.lessonProgress.aggregate({
      where: { userId },
      _sum: { timeSpentSeconds: true },
    });
    return result._sum.timeSpentSeconds ?? 0;
  }

  async findMaxLastViewedAt(userId: string): Promise<Date | null> {
    const result = await this.db.lessonProgress.aggregate({
      where: { userId },
      _max: { lastViewedAt: true },
    });
    return result._max.lastViewedAt ?? null;
  }

  findCourseSummary(courseId: string) {
    return this.db.course.findFirst({
      where: { id: courseId, deletedAt: null },
      select: { id: true, title: true, status: true },
    });
  }

  async findLiveCourseIds(): Promise<string[]> {
    const courses = await this.db.course.findMany({ where: { deletedAt: null }, select: { id: true } });
    return courses.map((course) => course.id);
  }

  /** Distinct TRAINEE members of groups the course is assigned to. */
  async findAssignedTraineeIdsForCourse(courseId: string): Promise<string[]> {
    const users = await this.db.user.findMany({
      where: {
        role: 'TRAINEE',
        groupMemberships: {
          some: { group: activeGroupScope({ courseAssignments: { some: { courseId } } }) },
        },
      },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  /** Published lessons of the course in funnel order: (module.order, lesson.order). */
  findOrderedPublishedLessonsForCourse(courseId: string) {
    return this.db.lesson.findMany({
      where: { isPublished: true, module: { isPublished: true, courseId } },
      orderBy: [{ module: { order: 'asc' } }, { order: 'asc' }],
      select: { id: true, title: true, module: { select: { title: true } } },
    });
  }

  async findProgressForLessonsAndUsers(
    lessonIds: string[],
    userIds: string[],
  ): Promise<CourseLessonProgressRow[]> {
    if (!lessonIds.length || !userIds.length) return [];
    return this.db.lessonProgress.findMany({
      where: { lessonId: { in: lessonIds }, userId: { in: userIds } },
      select: { userId: true, lessonId: true, status: true, timeSpentSeconds: true },
    });
  }

  // --- Assessments -----------------------------------------------------------------------------

  /** Distinct PUBLISHED, non-deleted assessments assigned to the user's groups. */
  countAssignedAssessmentsForUser(userId: string): Promise<number> {
    return this.db.assessment.count({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        groupAssignments: { some: { group: activeGroupScope({ members: { some: { userId } } }) } },
      },
    });
  }

  findAttemptStatsForUser(userId: string) {
    return this.db.assessmentAttempt.findMany({
      where: { userId },
      select: { percentage: true, passed: true, submittedAt: true },
    });
  }

  /** Attempt percentages (non-null only) across a set of users — the course averageScore proxy. */
  async findAttemptPercentagesForUsers(userIds: string[]): Promise<number[]> {
    if (!userIds.length) return [];
    const rows = await this.db.assessmentAttempt.findMany({
      where: { userId: { in: userIds }, percentage: { not: null } },
      select: { percentage: true },
    });
    return rows.flatMap((row) => (row.percentage === null ? [] : [row.percentage]));
  }

  findRecentAttemptsForUser(userId: string, limit: number) {
    return this.db.assessmentAttempt.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        assessmentId: true,
        status: true,
        percentage: true,
        passed: true,
        submittedAt: true,
        assessment: { select: { title: true } },
      },
    });
  }

  findAssessmentSummary(assessmentId: string) {
    return this.db.assessment.findFirst({
      where: { id: assessmentId, deletedAt: null },
      select: { id: true, title: true, status: true },
    });
  }

  async findLiveAssessmentIds(): Promise<string[]> {
    const assessments = await this.db.assessment.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    return assessments.map((assessment) => assessment.id);
  }

  /** Distinct TRAINEE members of groups the assessment is assigned to. */
  countAssignedTraineesForAssessment(assessmentId: string): Promise<number> {
    return this.db.user.count({
      where: {
        role: 'TRAINEE',
        groupMemberships: { some: { group: { assessmentGroupAssignments: { some: { assessmentId } } } } },
      },
    });
  }

  findAttemptsForAssessment(assessmentId: string) {
    return this.db.assessmentAttempt.findMany({
      where: { assessmentId },
      select: { status: true, percentage: true, passed: true },
    });
  }

  findAssessmentQuestionsWithBank(assessmentId: string) {
    return this.db.assessmentQuestion.findMany({
      where: { assessmentId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        snapshotTitle: true,
        snapshotType: true,
        question: { select: { category: true, difficulty: true } },
      },
    });
  }

  findAnswerStatsForAssessment(assessmentId: string) {
    return this.db.assessmentAnswer.findMany({
      where: { assessmentQuestion: { assessmentId } },
      select: { assessmentQuestionId: true, isCorrect: true },
    });
  }

  // --- AI tutor / Q&A --------------------------------------------------------------------------

  async countAiUsage(userId: string): Promise<{ conversations: number; messages: number }> {
    const [conversations, messages] = await Promise.all([
      this.db.aiConversation.count({ where: { userId } }),
      this.db.aiMessage.count({ where: { conversation: { userId } } }),
    ]);
    return { conversations, messages };
  }

  /** Live (non-deleted) Q&A engagement counts for the user's dashboard block. */
  async countQnaActivity(
    userId: string,
  ): Promise<{ questionsAsked: number; answersReceived: number; verifiedAnswers: number }> {
    const [questionsAsked, answersReceived, verifiedAnswers] = await Promise.all([
      this.db.qnaQuestion.count({ where: { authorId: userId, deletedAt: null } }),
      this.db.qnaAnswer.count({
        where: {
          deletedAt: null,
          authorId: { not: userId },
          question: { authorId: userId, deletedAt: null },
        },
      }),
      this.db.qnaAnswer.count({
        where: { deletedAt: null, isVerified: true, question: { authorId: userId, deletedAt: null } },
      }),
    ]);
    return { questionsAsked, answersReceived, verifiedAnswers };
  }

  // --- Snapshot cache tables ---------------------------------------------------------------------

  async findUserSnapshotAges(userIds: string[]): Promise<{ userId: string; computedAt: Date }[]> {
    if (!userIds.length) return [];
    return this.db.userPerformanceSnapshot.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, computedAt: true },
    });
  }

  async findUserSnapshots(userIds: string[]): Promise<UserPerformanceSnapshot[]> {
    if (!userIds.length) return [];
    return this.db.userPerformanceSnapshot.findMany({ where: { userId: { in: userIds } } });
  }

  findUserSnapshot(userId: string) {
    return this.db.userPerformanceSnapshot.findUnique({ where: { userId } });
  }

  upsertUserSnapshot(userId: string, data: UserSnapshotData) {
    const payload = { ...data, computedAt: new Date() };
    return this.db.userPerformanceSnapshot.upsert({
      where: { userId },
      create: { userId, ...payload },
      update: payload,
    });
  }

  async findCourseSnapshotComputedAt(courseId: string): Promise<Date | null> {
    const snapshot = await this.db.courseAnalyticsSnapshot.findUnique({
      where: { courseId },
      select: { computedAt: true },
    });
    return snapshot?.computedAt ?? null;
  }

  findCourseSnapshot(courseId: string) {
    return this.db.courseAnalyticsSnapshot.findUnique({ where: { courseId } });
  }

  upsertCourseSnapshot(courseId: string, data: CourseSnapshotData) {
    const payload = { ...data, lessonFunnel: toJson(data.lessonFunnel), computedAt: new Date() };
    return this.db.courseAnalyticsSnapshot.upsert({
      where: { courseId },
      create: { courseId, ...payload },
      update: payload,
    });
  }

  async findAssessmentSnapshotComputedAt(assessmentId: string): Promise<Date | null> {
    const snapshot = await this.db.assessmentAnalyticsSnapshot.findUnique({
      where: { assessmentId },
      select: { computedAt: true },
    });
    return snapshot?.computedAt ?? null;
  }

  findAssessmentSnapshot(assessmentId: string) {
    return this.db.assessmentAnalyticsSnapshot.findUnique({ where: { assessmentId } });
  }

  upsertAssessmentSnapshot(assessmentId: string, data: AssessmentSnapshotData) {
    const payload = {
      ...data,
      questionStats: toJson(data.questionStats),
      weakTopics: toJson(data.weakTopics),
      computedAt: new Date(),
    };
    return this.db.assessmentAnalyticsSnapshot.upsert({
      where: { assessmentId },
      create: { assessmentId, ...payload },
      update: payload,
    });
  }
}
