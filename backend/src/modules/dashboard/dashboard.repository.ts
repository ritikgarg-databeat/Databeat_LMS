import type { AnalyticsInsightScope, AnalyticsInsightSource, Prisma } from '@prisma/client';

import { BaseRepository } from '@/repositories/base.repository';

/** Single cast point for writing the insights array into `AnalyticsInsight.insights` (Json). */
const toJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export interface WrongAnswerCategoryRow {
  /** null when the bank Question was deleted (AssessmentQuestion.questionId is SetNull). */
  category: string | null;
}

// Data-access layer for the dashboard module. Only this class may query Prisma directly (see
// ARCHITECTURE.md §3.1). Owns the `AnalyticsInsight` cache table exclusively (the analytics
// module never writes to it — see that model's schema doc comment) plus a handful of
// feature-local queries the trainee/trainer dashboards need that don't already live behind a
// reusable method on another module's service (continue-learning, calendar, group/leaderboard
// analytics are all reused from their owning modules instead — see dashboard.service.ts).
export class DashboardRepository extends BaseRepository {
  // --- AnalyticsInsight cache (Prompt 8 § AI Insights) ----------------------------------------

  findInsight(scopeType: AnalyticsInsightScope, scopeId: string) {
    return this.db.analyticsInsight.findUnique({ where: { scopeType_scopeId: { scopeType, scopeId } } });
  }

  /** Upsert is the whole cache-write path — called for BOTH the AI result and the HEURISTIC fallback. */
  upsertInsight(
    scopeType: AnalyticsInsightScope,
    scopeId: string,
    data: { insights: unknown; source: AnalyticsInsightSource },
  ) {
    const payload = { insights: toJson(data.insights), source: data.source, generatedAt: new Date() };
    return this.db.analyticsInsight.upsert({
      where: { scopeType_scopeId: { scopeType, scopeId } },
      create: { scopeType, scopeId, ...payload },
      update: payload,
    });
  }

  // --- Trainee dashboard -----------------------------------------------------------------------

  /**
   * "Upcoming assessments" heuristic (Prompt 8 § GET /dashboard/trainee): the schema has no
   * "assigned but not started" flag, so this is derived — PUBLISHED, not-deleted, assigned to
   * one of the user's groups, due in the future, and with no AssessmentAttempt row from this
   * user yet (an attempt already in progress no longer counts as "upcoming").
   */
  findUpcomingAssessmentsForUser(userId: string, limit: number) {
    return this.db.assessment.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        dueDate: { gt: new Date() },
        groupAssignments: { some: { group: { members: { some: { userId } } } } },
        attempts: { none: { userId } },
      },
      orderBy: { dueDate: 'asc' },
      take: limit,
      select: { id: true, title: true, dueDate: true },
    });
  }

  // --- Weak-topic signal (shared by user + group insights) -------------------------------------

  /**
   * Wrong (`isCorrect: false`) answers across the given users' OWN attempts, each tagged with
   * its bank question's category. This is the real, per-user/per-group weak-topic signal —
   * category-level only (e.g. "SQL"), never sub-topic (e.g. not "SQL joins" specifically), since
   * `Question.category` is the finest-grained tag the schema has. See
   * dashboard-insights.service.ts's doc comment for how this is turned into an insight.
   */
  async findWrongAnswerCategoriesForUsers(userIds: string[]): Promise<WrongAnswerCategoryRow[]> {
    if (!userIds.length) return [];
    const rows = await this.db.assessmentAnswer.findMany({
      where: { isCorrect: false, attempt: { userId: { in: userIds } } },
      select: { assessmentQuestion: { select: { question: { select: { category: true } } } } },
    });
    return rows.map((row) => ({ category: row.assessmentQuestion.question?.category ?? null }));
  }

  // --- Trainer dashboard overview ---------------------------------------------------------------

  /** SUPER_ADMIN population for `overview.totalCourses`: every non-deleted course. */
  countAllCourses(): Promise<number> {
    return this.db.course.count({ where: { deletedAt: null } });
  }

  /** TRAINER population for `overview.totalCourses`: distinct courses assigned to their groups. */
  async countCoursesForGroups(groupIds: string[]): Promise<number> {
    if (!groupIds.length) return 0;
    const rows = await this.db.courseGroupAssignment.findMany({
      where: { groupId: { in: groupIds }, course: { deletedAt: null } },
      select: { courseId: true },
      distinct: ['courseId'],
    });
    return rows.length;
  }

  /** SUPER_ADMIN population for `overview.activeAssessments`: every published assessment. */
  countAllPublishedAssessments(): Promise<number> {
    return this.db.assessment.count({ where: { status: 'PUBLISHED', deletedAt: null } });
  }

  /** TRAINER population for `overview.activeAssessments`: distinct published assessments assigned to their groups. */
  async countActiveAssessmentsForGroups(groupIds: string[]): Promise<number> {
    if (!groupIds.length) return 0;
    const rows = await this.db.assessmentGroupAssignment.findMany({
      where: { groupId: { in: groupIds }, assessment: { status: 'PUBLISHED', deletedAt: null } },
      select: { assessmentId: true },
      distinct: ['assessmentId'],
    });
    return rows.length;
  }
}
