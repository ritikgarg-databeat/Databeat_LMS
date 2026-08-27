import { QuestionType } from '@prisma/client';

import { LESSON_QUIZ_PASS_PERCENTAGE } from '@/constants/lesson-quiz';
import { BaseRepository } from '@/repositories/base.repository';
import { endOfDayInclusive } from '@/utils/date-range.util';

/**
 * Feature-local copy of the grading-relevant QuestionType groupings — deliberately duplicated
 * rather than cross-imported from modules/assessment-attempts (mirrors this codebase's
 * established "feature-local duplication over premature cross-module coupling" convention, see
 * lesson-quiz.repository.ts's own doc comment for the same call).
 */
const AUTO_GRADABLE_QUESTION_TYPES = [
  QuestionType.SINGLE_CORRECT_MCQ,
  QuestionType.MULTIPLE_CORRECT,
  QuestionType.TRUE_FALSE,
  QuestionType.FILL_IN_THE_BLANK,
  QuestionType.SQL_QUERY,
] as const;

const MANUAL_REVIEW_QUESTION_TYPES = [
  QuestionType.SHORT_ANSWER,
  QuestionType.LONG_ANSWER,
  QuestionType.CODE_SNIPPET,
  QuestionType.FILE_UPLOAD,
] as const;

/** One raw timed observation extracted from usage logs — `actorId` is whichever real person's
 * action produced this row (a trainee for grading/quiz-gen, whoever ran the import for CSV). */
export interface UsageLatencySample {
  durationMs: number;
  actorId: string;
  occurredAt: Date;
}

function dateRangeWhere(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  if (!from && !to) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = endOfDayInclusive(to);
  return range;
}

// Data-access layer for the impact-metrics module. Only this class may query Prisma directly
// (see ARCHITECTURE.md §3.1). Read-only — every method here derives numbers from data other
// modules already wrote, it never writes anything itself.
export class ImpactMetricsRepository extends BaseRepository {
  /** Attempts where EVERY answered question is auto-gradable — `gradedAt` for these is set in
   * the same request as `submittedAt`, so the gap is real end-to-end auto-grading latency. */
  async findAutoGradedLatencies(from?: string, to?: string): Promise<UsageLatencySample[]> {
    const submittedAt = dateRangeWhere(from, to);
    const attempts = await this.db.assessmentAttempt.findMany({
      where: {
        submittedAt: submittedAt ? { not: null, ...submittedAt } : { not: null },
        gradedAt: { not: null },
        answers: {
          none: { assessmentQuestion: { snapshotType: { notIn: [...AUTO_GRADABLE_QUESTION_TYPES] } } },
        },
      },
      select: { userId: true, submittedAt: true, gradedAt: true },
    });

    return attempts
      .filter((attempt) => attempt.submittedAt && attempt.gradedAt)
      .map((attempt) => ({
        durationMs: attempt.gradedAt!.getTime() - attempt.submittedAt!.getTime(),
        actorId: attempt.userId,
        occurredAt: attempt.submittedAt as Date,
      }));
  }

  /** `generationDurationMs` is null for every attempt created before that column existed — this
   * report only ever sees attempts generated since Task 2b shipped, by construction. */
  async findAiQuizGenLatencies(from?: string, to?: string): Promise<UsageLatencySample[]> {
    const generatedAt = dateRangeWhere(from, to);
    const attempts = await this.db.lessonQuizAttempt.findMany({
      where: { generationDurationMs: { not: null }, ...(generatedAt ? { generatedAt } : {}) },
      select: { userId: true, generatedAt: true, generationDurationMs: true },
    });

    return attempts.map((attempt) => ({
      durationMs: attempt.generationDurationMs as number,
      actorId: attempt.userId,
      occurredAt: attempt.generatedAt,
    }));
  }

  /** `metadata.durationMs` is null for every GROUP_BULK_IMPORT logged before Task 2b shipped —
   * filtered out in JS since Prisma can't type-check inside a `Json` column. */
  async findCsvImportDurations(from?: string, to?: string): Promise<UsageLatencySample[]> {
    const createdAt = dateRangeWhere(from, to);
    const logs = await this.db.auditLog.findMany({
      where: { action: 'GROUP_BULK_IMPORT', ...(createdAt ? { createdAt } : {}), actorId: { not: null } },
      select: { actorId: true, createdAt: true, metadata: true },
    });

    const samples: UsageLatencySample[] = [];
    for (const log of logs) {
      const metadata = log.metadata as { durationMs?: unknown } | null;
      if (metadata && typeof metadata.durationMs === 'number' && log.actorId) {
        samples.push({ durationMs: metadata.durationMs, actorId: log.actorId, occurredAt: log.createdAt });
      }
    }
    return samples;
  }

  findGroupById(groupId: string) {
    return this.db.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true, trainerId: true },
    });
  }

  async findGroupMemberUserIds(groupId: string, joinedBefore?: Date): Promise<string[]> {
    const members = await this.db.groupMember.findMany({
      where: { groupId, ...(joinedBefore ? { joinedAt: { lte: joinedBefore } } : {}) },
      select: { userId: true },
    });
    return members.map((member) => member.userId);
  }

  /**
   * Every lesson-completion in range for the cohort, each paired with whether a
   * LessonQuizAttempt row exists for that same (lesson, user) pair — its existence at all IS
   * "this lesson had a real quiz requirement" (getOrCreateAttempt only ever creates one when
   * content was long enough and generation succeeded), and `checkCompletionGate` structurally
   * cannot let a GENERATED (unsubmitted) attempt's lesson reach COMPLETED — so any row that
   * comes back with a requirement but a non-SUBMITTED status is a real bug, not expected data.
   */
  async findCompletionsWithQuizStatus(
    userIds: string[],
    from?: string,
    to?: string,
  ): Promise<
    { lessonId: string; lessonTitle: string; userId: string; completedAt: Date; quizStatus: string | null }[]
  > {
    if (userIds.length === 0) return [];
    const completedAt = dateRangeWhere(from, to);
    const completions = await this.db.lessonProgress.findMany({
      where: {
        userId: { in: userIds },
        status: 'COMPLETED',
        completedAt: completedAt ? { not: null, ...completedAt } : { not: null },
      },
      select: {
        userId: true,
        lessonId: true,
        completedAt: true,
        completedContentVersion: true,
        lesson: { select: { title: true } },
      },
    });
    if (completions.length === 0) return [];

    const quizAttempts = await this.db.lessonQuizAttempt.findMany({
      where: {
        userId: { in: userIds },
        lessonId: { in: [...new Set(completions.map((completion) => completion.lessonId))] },
      },
      select: { userId: true, lessonId: true, contentVersion: true, status: true, percentage: true },
    });
    const quizStatusByKey = new Map<string, string>();
    for (const attempt of quizAttempts) {
      const key = `${attempt.lessonId}:${attempt.userId}:${attempt.contentVersion}`;
      const passed =
        attempt.status === 'SUBMITTED' && (attempt.percentage ?? 0) >= LESSON_QUIZ_PASS_PERCENTAGE;
      if (passed || !quizStatusByKey.has(key))
        quizStatusByKey.set(key, passed ? 'SUBMITTED' : attempt.status);
    }

    return completions.map((completion) => ({
      lessonId: completion.lessonId,
      lessonTitle: completion.lesson.title,
      userId: completion.userId,
      completedAt: completion.completedAt as Date,
      quizStatus:
        completion.completedContentVersion === null
          ? null
          : (quizStatusByKey.get(
              `${completion.lessonId}:${completion.userId}:${completion.completedContentVersion}`,
            ) ?? null),
    }));
  }

  async findSubmittedQuizPercentages(userIds: string[], from?: string, to?: string): Promise<number[]> {
    if (userIds.length === 0) return [];
    const submittedAt = dateRangeWhere(from, to);
    const attempts = await this.db.lessonQuizAttempt.findMany({
      where: {
        userId: { in: userIds },
        status: 'SUBMITTED',
        percentage: { not: null },
        ...(submittedAt ? { submittedAt } : {}),
      },
      select: { percentage: true },
    });
    return attempts.map((attempt) => attempt.percentage as number);
  }

  /** Manual-review complement to `findAutoGradedLatencies` — per-ANSWER turnaround (not
   * per-attempt), scoped to the cohort. */
  async findManualGradingTurnaround(userIds: string[], from?: string, to?: string): Promise<number[]> {
    if (userIds.length === 0) return [];
    const submittedAt = dateRangeWhere(from, to);
    const answers = await this.db.assessmentAnswer.findMany({
      where: {
        gradedAt: { not: null },
        assessmentQuestion: { snapshotType: { in: [...MANUAL_REVIEW_QUESTION_TYPES] } },
        attempt: {
          userId: { in: userIds },
          submittedAt: submittedAt ? { not: null, ...submittedAt } : { not: null },
        },
      },
      select: { gradedAt: true, attempt: { select: { submittedAt: true } } },
    });

    return answers
      .filter((answer) => answer.gradedAt && answer.attempt.submittedAt)
      .map((answer) => answer.gradedAt!.getTime() - answer.attempt.submittedAt!.getTime());
  }

  async findActiveUserIdsInWindow(
    userIds: string[],
    windowStart: Date,
    windowEnd: Date,
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();

    const [viewedLessons, touchedAssessments, aiConversations] = await Promise.all([
      this.db.lessonProgress.findMany({
        where: { userId: { in: userIds }, lastViewedAt: { gte: windowStart, lte: windowEnd } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.db.assessmentAttempt.findMany({
        where: {
          userId: { in: userIds },
          OR: [
            { startedAt: { gte: windowStart, lte: windowEnd } },
            { submittedAt: { gte: windowStart, lte: windowEnd } },
          ],
        },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.db.aiConversation.findMany({
        where: { userId: { in: userIds }, updatedAt: { gte: windowStart, lte: windowEnd } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    return new Set([...viewedLessons, ...touchedAssessments, ...aiConversations].map((row) => row.userId));
  }
}
