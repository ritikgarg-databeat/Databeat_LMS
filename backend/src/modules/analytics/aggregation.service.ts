import type { AssessmentAttemptStatus, QuestionCategory, UserPerformanceSnapshot } from '@prisma/client';

import { ANALYTICS_ACTIVITY_WINDOW_DAYS, ANALYTICS_SNAPSHOT_TTL_MS } from '@/constants/analytics';
import { BaseService } from '@/services/base.service';
import { logger } from '@/utils/logger';

import { AnalyticsRepository, type NewDailyActivityRow } from './analytics.repository';
import type {
  AssessmentQuestionStat,
  AssessmentWeakTopic,
  LessonFunnelStep,
  RefreshResult,
} from './analytics.types';
import {
  addUtcDays,
  computeDropOff,
  computePerformanceScore,
  mean,
  percentage,
  round1,
  toUtcDayString,
  utcDayToDate,
} from './metrics-calculator';

const ATTEMPT_SUBMITTED_STATUSES: AssessmentAttemptStatus[] = ['SUBMITTED', 'PENDING_REVIEW', 'GRADED'];

/**
 * The analytics "Aggregation Jobs" service — sole writer of the analytics cache tables
 * (UserDailyActivity, UserPerformanceSnapshot, CourseAnalyticsSnapshot,
 * AssessmentAnalyticsSnapshot). Every `ensure*` method computes missing data synchronously,
 * serves stale data while refreshing it in the background, and skips work while `computedAt` is
 * within ANALYTICS_SNAPSHOT_TTL_MS. `refreshAll` is the force entry point for a scheduler/queue.
 *
 * Concurrency: every recompute is an idempotent window-rewrite or upsert derived purely from
 * transactional-table data, so concurrent duplicate work is harmless (last write wins, both
 * writes carry the same derived values) — no locking needed.
 */
export class AggregationService extends BaseService {
  private readonly dailyActivityRefreshes = new Map<string, Promise<void>>();
  private readonly userSnapshotRefreshes = new Map<string, Promise<void>>();
  private readonly courseSnapshotRefreshes = new Map<string, Promise<void>>();
  private readonly assessmentSnapshotRefreshes = new Map<string, Promise<void>>();

  constructor(protected readonly repository: AnalyticsRepository = new AnalyticsRepository()) {
    super();
  }

  /**
   * Recompute the user's last `days` (default ANALYTICS_ACTIVITY_WINDOW_DAYS) days of
   * UserDailyActivity unless the newest row's computedAt is still within TTL. A user with zero
   * activity persists an all-zero marker for today so the guard can still observe freshness.
   */
  async ensureUserDailyActivity(
    userId: string,
    days: number = ANALYTICS_ACTIVITY_WINDOW_DAYS,
  ): Promise<void> {
    const latestComputedAt = await this.repository.findLatestDailyActivityComputedAt(userId);
    if (!latestComputedAt) {
      await this.refreshDailyActivity(userId, days);
      return;
    }
    if (Date.now() - latestComputedAt.getTime() < ANALYTICS_SNAPSHOT_TTL_MS) return;

    void this.refreshDailyActivity(userId, days).catch((error: unknown) => {
      logger.error('Background daily-activity refresh failed', { error, userId });
    });
  }

  /** Recompute UserPerformanceSnapshot for every given user whose row is missing or stale. */
  async ensureUserSnapshots(userIds: string[]): Promise<UserPerformanceSnapshot[]> {
    const uniqueIds = [...new Set(userIds)];
    if (!uniqueIds.length) return [];

    const snapshots = await this.repository.findUserSnapshots(uniqueIds);
    const computedAtByUser = new Map(snapshots.map((row) => [row.userId, row.computedAt]));
    const staleCutoff = Date.now() - ANALYTICS_SNAPSHOT_TTL_MS;
    const missingIds = uniqueIds.filter((id) => !computedAtByUser.has(id));
    const staleIds = uniqueIds.filter((id) => {
      const computedAt = computedAtByUser.get(id);
      return computedAt !== undefined && computedAt.getTime() < staleCutoff;
    });

    await Promise.all(missingIds.map((userId) => this.refreshUserSnapshot(userId)));
    for (const userId of staleIds) {
      void this.refreshUserSnapshot(userId).catch((error: unknown) => {
        logger.error('Background user analytics refresh failed', { error, userId });
      });
    }
    return missingIds.length > 0 ? this.repository.findUserSnapshots(uniqueIds) : snapshots;
  }

  /** TTL-guarded recompute of CourseAnalyticsSnapshot. */
  async ensureCourseSnapshot(courseId: string): Promise<void> {
    const computedAt = await this.repository.findCourseSnapshotComputedAt(courseId);
    if (!computedAt) {
      await this.refreshCourseSnapshot(courseId);
      return;
    }
    if (Date.now() - computedAt.getTime() < ANALYTICS_SNAPSHOT_TTL_MS) return;
    void this.refreshCourseSnapshot(courseId).catch((error: unknown) => {
      logger.error('Background course analytics refresh failed', { courseId, error });
    });
  }

  /** TTL-guarded recompute of AssessmentAnalyticsSnapshot. */
  async ensureAssessmentSnapshot(assessmentId: string): Promise<void> {
    const computedAt = await this.repository.findAssessmentSnapshotComputedAt(assessmentId);
    if (!computedAt) {
      await this.refreshAssessmentSnapshot(assessmentId);
      return;
    }
    if (Date.now() - computedAt.getTime() < ANALYTICS_SNAPSHOT_TTL_MS) return;
    void this.refreshAssessmentSnapshot(assessmentId).catch((error: unknown) => {
      logger.error('Background assessment analytics refresh failed', { assessmentId, error });
    });
  }

  /**
   * Force-recompute (TTL ignored) every active trainee's daily activity + performance snapshot,
   * every non-deleted course snapshot, and every non-deleted assessment snapshot. This is the
   * entry point a future scheduler/queue calls — the "background processing ready" seam
   * (Prompt 8 § PERFORMANCE). The stale-while-refresh guards remain a request-path safety net.
   */
  async refreshAll(): Promise<RefreshResult> {
    const [userIds, courseIds, assessmentIds] = await Promise.all([
      this.repository.findActiveTraineeIds(),
      this.repository.findLiveCourseIds(),
      this.repository.findLiveAssessmentIds(),
    ]);

    for (const userId of userIds) await this.refreshUserSnapshot(userId);
    for (const courseId of courseIds) await this.refreshCourseSnapshot(courseId);
    for (const assessmentId of assessmentIds) await this.refreshAssessmentSnapshot(assessmentId);

    return { users: userIds.length, courses: courseIds.length, assessments: assessmentIds.length };
  }

  /**
   * Rebuild the user's UserDailyActivity rows for the trailing `days` UTC calendar days
   * (inclusive of today) from the five immutable transactional sources, bucketing every
   * timestamp by its UTC date. Idempotent: the window is deleted then re-inserted, and only
   * days with at least one nonzero count are persisted.
   */
  private async recomputeUserDailyActivity(userId: string, days: number): Promise<void> {
    const today = toUtcDayString(new Date());
    const windowStart = utcDayToDate(addUtcDays(today, -(days - 1)));

    const [logins, lessonCompletions, submissions, aiMessages, qnaPosts] = await Promise.all([
      this.repository.findLoginTimestamps(userId, windowStart),
      this.repository.findLessonCompletionTimestamps(userId, windowStart),
      this.repository.findAssessmentSubmissionTimestamps(userId, windowStart),
      this.repository.findAiMessageTimestamps(userId, windowStart),
      this.repository.findQnaPostTimestamps(userId, windowStart),
    ]);

    const buckets = new Map<string, NewDailyActivityRow>();
    const bucketFor = (timestamp: Date): NewDailyActivityRow => {
      const day = toUtcDayString(timestamp);
      let row = buckets.get(day);
      if (!row) {
        row = {
          date: utcDayToDate(day),
          logins: 0,
          lessonsCompleted: 0,
          assessmentsSubmitted: 0,
          aiMessages: 0,
          qnaPosts: 0,
        };
        buckets.set(day, row);
      }
      return row;
    };

    for (const timestamp of logins) bucketFor(timestamp).logins += 1;
    for (const timestamp of lessonCompletions) bucketFor(timestamp).lessonsCompleted += 1;
    for (const timestamp of submissions) bucketFor(timestamp).assessmentsSubmitted += 1;
    for (const timestamp of aiMessages) bucketFor(timestamp).aiMessages += 1;
    for (const timestamp of qnaPosts) bucketFor(timestamp).qnaPosts += 1;

    const rows = [...buckets.values()];
    if (rows.length === 0) {
      rows.push({
        date: utcDayToDate(today),
        logins: 0,
        lessonsCompleted: 0,
        assessmentsSubmitted: 0,
        aiMessages: 0,
        qnaPosts: 0,
      });
    }
    await this.repository.replaceDailyActivity(userId, windowStart, rows);
  }

  private refreshDailyActivity(userId: string, days: number): Promise<void> {
    const existing = this.dailyActivityRefreshes.get(userId);
    if (existing) return existing;

    const refresh = this.recomputeUserDailyActivity(userId, days).finally(() => {
      this.dailyActivityRefreshes.delete(userId);
    });
    this.dailyActivityRefreshes.set(userId, refresh);
    return refresh;
  }

  private refreshUserSnapshot(userId: string): Promise<void> {
    const existing = this.userSnapshotRefreshes.get(userId);
    if (existing) return existing;

    const refresh = (async () => {
      await this.refreshDailyActivity(userId, ANALYTICS_ACTIVITY_WINDOW_DAYS);
      await this.recomputeUserSnapshot(userId);
    })().finally(() => {
      this.userSnapshotRefreshes.delete(userId);
    });
    this.userSnapshotRefreshes.set(userId, refresh);
    return refresh;
  }

  private refreshCourseSnapshot(courseId: string): Promise<void> {
    const existing = this.courseSnapshotRefreshes.get(courseId);
    if (existing) return existing;
    const refresh = this.recomputeCourseSnapshot(courseId).finally(() => {
      this.courseSnapshotRefreshes.delete(courseId);
    });
    this.courseSnapshotRefreshes.set(courseId, refresh);
    return refresh;
  }

  private refreshAssessmentSnapshot(assessmentId: string): Promise<void> {
    const existing = this.assessmentSnapshotRefreshes.get(assessmentId);
    if (existing) return existing;
    const refresh = this.recomputeAssessmentSnapshot(assessmentId).finally(() => {
      this.assessmentSnapshotRefreshes.delete(assessmentId);
    });
    this.assessmentSnapshotRefreshes.set(assessmentId, refresh);
    return refresh;
  }

  /** Recompute + upsert the user's UserPerformanceSnapshot from the transactional tables. */
  private async recomputeUserSnapshot(userId: string): Promise<void> {
    const user = await this.repository.findUserById(userId);
    if (!user) return; // user vanished between listing and recompute — nothing to snapshot

    const courses = await this.repository.findAccessibleCourses(userId);
    const courseIds = courses.map((course) => course.id);
    const lessons = await this.repository.findPublishedLessonRefsForCourses(courseIds);
    const lessonIds = lessons.map((lesson) => lesson.id);

    const today = toUtcDayString(new Date());
    const last7Start = utcDayToDate(addUtcDays(today, -6)); // trailing 7 calendar days incl. today

    const [progressRows, timeSpentSeconds, assessmentsAssigned, attempts, maxLastViewedAt, activityEvents7d] =
      await Promise.all([
        this.repository.findLessonProgressRows(userId, lessonIds),
        this.repository.sumTimeSpentForUser(userId),
        this.repository.countAssignedAssessmentsForUser(userId),
        this.repository.findAttemptStatsForUser(userId),
        this.repository.findMaxLastViewedAt(userId),
        this.repository.sumDailyActivitySince(userId, last7Start),
      ]);

    const completedLessonIds = new Set(
      progressRows.filter((row) => row.status === 'COMPLETED').map((row) => row.lessonId),
    );

    // A course counts as completed when EVERY published lesson is COMPLETED and it has at
    // least one published lesson — same formula as the progress module's completion rule.
    const lessonTallyByCourse = new Map<string, { total: number; completed: number }>();
    for (const lesson of lessons) {
      const tally = lessonTallyByCourse.get(lesson.courseId) ?? { total: 0, completed: 0 };
      tally.total += 1;
      if (completedLessonIds.has(lesson.id)) tally.completed += 1;
      lessonTallyByCourse.set(lesson.courseId, tally);
    }
    const coursesCompleted = [...lessonTallyByCourse.values()].filter(
      (tally) => tally.total > 0 && tally.completed === tally.total,
    ).length;

    const totalAssignedLessons = lessons.length;
    const lessonsCompleted = completedLessonIds.size;
    const completionPercentage = percentage(lessonsCompleted, totalAssignedLessons);

    const scores = attempts
      .map((attempt) => attempt.percentage)
      .filter((value): value is number => value !== null);
    const rawAverageScore = mean(scores);
    const averageScore = rawAverageScore === null ? null : round1(rawAverageScore);

    const activityCandidates = [
      user.lastLogin,
      maxLastViewedAt,
      ...attempts.map((attempt) => attempt.submittedAt),
    ].filter((value): value is Date => value !== null);
    const lastActivityAt = activityCandidates.length
      ? new Date(Math.max(...activityCandidates.map((value) => value.getTime())))
      : null;

    await this.repository.upsertUserSnapshot(userId, {
      coursesAssigned: courseIds.length,
      coursesCompleted,
      lessonsCompleted,
      totalAssignedLessons,
      completionPercentage,
      timeSpentSeconds,
      assessmentsAssigned,
      assessmentsTaken: attempts.length,
      assessmentsPassed: attempts.filter((attempt) => attempt.passed === true).length,
      averageScore,
      activityEvents7d,
      performanceScore: computePerformanceScore({ completionPercentage, averageScore, activityEvents7d }),
      lastActivityAt,
    });
  }

  /** Recompute + upsert the course's CourseAnalyticsSnapshot (funnel, rates, time-spent). */
  private async recomputeCourseSnapshot(courseId: string): Promise<void> {
    const [assignedTraineeIds, lessons] = await Promise.all([
      this.repository.findAssignedTraineeIdsForCourse(courseId),
      this.repository.findOrderedPublishedLessonsForCourse(courseId),
    ]);
    const lessonIds = lessons.map((lesson) => lesson.id);
    const [progressRows, attemptScores] = await Promise.all([
      this.repository.findProgressForLessonsAndUsers(lessonIds, assignedTraineeIds),
      this.repository.findAttemptPercentagesForUsers(assignedTraineeIds),
    ]);

    const assignedTrainees = assignedTraineeIds.length;

    const startedUserIds = new Set(progressRows.map((row) => row.userId));
    const completedByUser = new Map<string, number>();
    const timeByUser = new Map<string, number>();
    const completedCountByLesson = new Map<string, number>();
    for (const row of progressRows) {
      timeByUser.set(row.userId, (timeByUser.get(row.userId) ?? 0) + row.timeSpentSeconds);
      if (row.status === 'COMPLETED') {
        completedByUser.set(row.userId, (completedByUser.get(row.userId) ?? 0) + 1);
        completedCountByLesson.set(row.lessonId, (completedCountByLesson.get(row.lessonId) ?? 0) + 1);
      }
    }

    const completedCount =
      lessons.length === 0
        ? 0
        : assignedTraineeIds.filter((id) => (completedByUser.get(id) ?? 0) === lessons.length).length;

    // Per-assigned-user mean time on this course's lessons — users with no progress count as 0.
    const averageTimeSpentSeconds = Math.round(
      mean(assignedTraineeIds.map((id) => timeByUser.get(id) ?? 0)) ?? 0,
    );

    // Population proxy: assessments carry no course linkage in this schema (standalone and
    // group-assigned — see CourseAnalyticsSnapshot's doc comment), so this is the mean attempt
    // percentage across the course's ASSIGNED trainees, not "scores on this course's assessments".
    const rawAverageScore = mean(attemptScores);
    const averageScore = rawAverageScore === null ? null : round1(rawAverageScore);

    const completionRates = lessons.map((lesson) =>
      percentage(completedCountByLesson.get(lesson.id) ?? 0, assignedTrainees),
    );
    const dropOffRates = computeDropOff(completionRates);
    const lessonFunnel: LessonFunnelStep[] = lessons.map((lesson, index) => ({
      lessonId: lesson.id,
      title: lesson.title,
      moduleTitle: lesson.module.title,
      order: index + 1,
      completedCount: completedCountByLesson.get(lesson.id) ?? 0,
      completionRate: completionRates[index] ?? 0,
      dropOffRate: dropOffRates[index] ?? 0,
    }));

    await this.repository.upsertCourseSnapshot(courseId, {
      assignedTrainees,
      startedCount: startedUserIds.size,
      completedCount,
      completionRate: percentage(completedCount, assignedTrainees),
      averageTimeSpentSeconds,
      averageScore,
      lessonFunnel,
    });
  }

  /** Recompute + upsert the assessment's AssessmentAnalyticsSnapshot (participation, question stats). */
  private async recomputeAssessmentSnapshot(assessmentId: string): Promise<void> {
    const [assignedTrainees, attempts, questions, answers] = await Promise.all([
      this.repository.countAssignedTraineesForAssessment(assessmentId),
      this.repository.findAttemptsForAssessment(assessmentId),
      this.repository.findAssessmentQuestionsWithBank(assessmentId),
      this.repository.findAnswerStatsForAssessment(assessmentId),
    ]);

    const submittedCount = attempts.filter((attempt) =>
      ATTEMPT_SUBMITTED_STATUSES.includes(attempt.status),
    ).length;
    const gradedCount = attempts.filter((attempt) => attempt.status === 'GRADED').length;

    const scores = attempts
      .map((attempt) => attempt.percentage)
      .filter((value): value is number => value !== null);
    const rawAverageScore = mean(scores);
    const averageScore = rawAverageScore === null ? null : round1(rawAverageScore);

    const decidedAttempts = attempts.filter((attempt) => attempt.passed !== null);
    const passRate = percentage(
      decidedAttempts.filter((attempt) => attempt.passed === true).length,
      decidedAttempts.length,
    );

    // Per-question answer tallies. `decided` (isCorrect != null) is the correctRate denominator —
    // manually-graded answers awaiting review contribute to answeredCount but not to the rate.
    const answerTallies = new Map<string, { answered: number; correct: number; decided: number }>();
    for (const answer of answers) {
      const tally = answerTallies.get(answer.assessmentQuestionId) ?? { answered: 0, correct: 0, decided: 0 };
      tally.answered += 1;
      if (answer.isCorrect !== null) tally.decided += 1;
      if (answer.isCorrect === true) tally.correct += 1;
      answerTallies.set(answer.assessmentQuestionId, tally);
    }

    const questionStats: AssessmentQuestionStat[] = questions.map((question) => {
      const tally = answerTallies.get(question.id) ?? { answered: 0, correct: 0, decided: 0 };
      return {
        assessmentQuestionId: question.id,
        title: question.snapshotTitle,
        type: question.snapshotType,
        // Bank question deleted (questionId SetNull) → bucket under 'UNKNOWN', no difficulty —
        // see AssessmentAnalyticsSnapshot's schema doc comment.
        category: question.question?.category ?? 'UNKNOWN',
        difficulty: question.question?.difficulty ?? null,
        answeredCount: tally.answered,
        correctCount: tally.correct,
        correctRate: percentage(tally.correct, tally.decided),
      };
    });

    const topicTallies = new Map<
      QuestionCategory | 'UNKNOWN',
      { answered: number; correct: number; decided: number }
    >();
    for (const question of questions) {
      const category = question.question?.category ?? 'UNKNOWN';
      const tally = answerTallies.get(question.id) ?? { answered: 0, correct: 0, decided: 0 };
      const topic = topicTallies.get(category) ?? { answered: 0, correct: 0, decided: 0 };
      topic.answered += tally.answered;
      topic.correct += tally.correct;
      topic.decided += tally.decided;
      topicTallies.set(category, topic);
    }
    const weakTopics: AssessmentWeakTopic[] = [...topicTallies.entries()]
      .map(([category, tally]) => ({
        category,
        answeredCount: tally.answered,
        correctCount: tally.correct,
        correctRate: percentage(tally.correct, tally.decided),
      }))
      .sort((a, b) => a.correctRate - b.correctRate);

    await this.repository.upsertAssessmentSnapshot(assessmentId, {
      assignedTrainees,
      attemptedCount: attempts.length,
      submittedCount,
      gradedCount,
      participationRate: percentage(attempts.length, assignedTrainees),
      averageScore,
      passRate,
      questionStats,
      weakTopics,
    });
  }
}

export const aggregationService = new AggregationService();
