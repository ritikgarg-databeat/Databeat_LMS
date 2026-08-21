import type { Role, UserPerformanceSnapshot } from '@prisma/client';

import {
  ANALYTICS_ACTIVITY_WINDOW_DAYS,
  ANALYTICS_STREAK_LOOKBACK_DAYS,
  ANALYTICS_TIMELINE_DAYS,
  LEADERBOARD_DEFAULT_LIMIT,
  LEADERBOARD_MAX_LIMIT,
} from '@/constants/analytics';
import { BaseService } from '@/services/base.service';
import { ForbiddenError, NotFoundError } from '@/utils/app-error';

import { aggregationService, type AggregationService } from './aggregation.service';
import { AnalyticsRepository, type DailyActivityCounts } from './analytics.repository';
import type {
  AssessmentAnalytics,
  AssessmentQuestionStat,
  AssessmentWeakTopic,
  CourseAnalytics,
  DailyActivityPoint,
  GroupAnalyticsDetail,
  GroupAnalyticsRow,
  GroupMemberAnalyticsRow,
  GroupsAnalyticsFilters,
  LeaderboardEntry,
  LeaderboardFilters,
  LessonFunnelStep,
  RefreshResult,
  UserAnalytics,
  UserCourseAnalyticsRow,
  UserRecentAttemptRow,
} from './analytics.types';
import {
  addUtcDays,
  computeStreakDays,
  mean,
  percentage,
  round1,
  toUtcDayString,
  utcDayToDate,
} from './metrics-calculator';

interface Actor {
  id: string;
  role: Role;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Business logic for the analytics module. Controllers call into this layer only.
//
// SECURITY MODEL (Prompt 8 § SECURITY — deliberately STRICTER than earlier modules' staff-wide
// access, because analytics is personal-performance data):
//   - SUPER_ADMIN sees everything.
//   - TRAINER sees ONLY groups where Group.trainerId is their id, and ONLY trainees who are
//     members of those groups. (Earlier modules let any staff member read any group; here a
//     trainer being able to rank/inspect trainees they don't train would be a privacy leak.)
//   - TRAINEE sees only their own data, via `GET /analytics/me` (or `/users/:id` with their
//     own id — the same self-or-visible check).
//   - Course/assessment analytics are the exception: content-level, staff-wide — see
//     getCourseAnalytics's doc comment.
export class AnalyticsService extends BaseService {
  constructor(
    protected readonly repository: AnalyticsRepository = new AnalyticsRepository(),
    protected readonly aggregation: AggregationService = aggregationService,
  ) {
    super();
  }

  /** Group list rows for the trainer/admin dashboard — TRAINER: own groups only; SUPER_ADMIN: all. */
  async getGroupsAnalytics(actor: Actor, filters: GroupsAnalyticsFilters): Promise<GroupAnalyticsRow[]> {
    // Any non-SUPER_ADMIN is trainer-scoped — the route already blocks TRAINEEs, this keeps the
    // scoping correct even if a new staff-ish role is ever added.
    const trainerId = actor.role === 'SUPER_ADMIN' ? undefined : actor.id;
    const groups = await this.repository.findGroupsWithTraineeMembers({
      trainerId,
      departmentId: filters.departmentId,
    });

    const memberIds = [...new Set(groups.flatMap((group) => group.members.map((member) => member.userId)))];
    const snapshots = await this.aggregation.ensureUserSnapshots(memberIds);
    const snapshotByUser = new Map(snapshots.map((snapshot) => [snapshot.userId, snapshot]));

    return groups.map((group) => {
      const memberSnapshots = group.members
        .map((member) => snapshotByUser.get(member.userId))
        .filter((snapshot): snapshot is UserPerformanceSnapshot => snapshot !== undefined);
      return {
        groupId: group.id,
        name: group.name,
        code: group.code,
        status: group.status,
        departmentName: group.department.name,
        traineeCount: group.members.length,
        ...this.aggregateMemberSnapshots(memberSnapshots),
      };
    });
  }

  /** Group detail: summary, member ranking, and a zero-filled 30-day activity timeline. */
  async getGroupAnalytics(groupId: string, actor: Actor): Promise<GroupAnalyticsDetail> {
    const group = await this.repository.findGroupDetail(groupId);
    if (!group) throw new NotFoundError('Group not found.');
    if (actor.role !== 'SUPER_ADMIN' && group.trainerId !== actor.id) {
      throw new ForbiddenError("You don't have permission to view this group's analytics.");
    }

    const members = group.members.map((member) => member.user);
    const memberIds = members.map((member) => member.id);
    const snapshots = await this.aggregation.ensureUserSnapshots(memberIds);
    const snapshotByUser = new Map(snapshots.map((snapshot) => [snapshot.userId, snapshot]));

    const aggregate = this.aggregateMemberSnapshots(snapshots);
    const totalTimeSpentSeconds = snapshots.reduce((sum, snapshot) => sum + snapshot.timeSpentSeconds, 0);

    const memberRows: GroupMemberAnalyticsRow[] = members
      .map((member) => {
        const snapshot = snapshotByUser.get(member.id);
        return {
          userId: member.id,
          name: `${member.firstName} ${member.lastName}`,
          email: member.email,
          completionPercentage: snapshot?.completionPercentage ?? 0,
          averageScore: snapshot?.averageScore ?? null,
          lessonsCompleted: snapshot?.lessonsCompleted ?? 0,
          assessmentsTaken: snapshot?.assessmentsTaken ?? 0,
          lastActivityAt: snapshot?.lastActivityAt ?? null,
          performanceScore: snapshot?.performanceScore ?? 0,
        };
      })
      .sort((a, b) => b.performanceScore - a.performanceScore);

    const timelineStart = addUtcDays(toUtcDayString(new Date()), -(ANALYTICS_TIMELINE_DAYS - 1));
    const activityRows = await this.repository.findDailyActivityForUsers(
      memberIds,
      utcDayToDate(timelineStart),
    );

    return {
      group: { groupId: group.id, name: group.name, code: group.code, departmentName: group.department.name },
      summary: {
        traineeCount: members.length,
        completionPercentage: aggregate.completionPercentage,
        averageScore: aggregate.averageScore,
        activeUsers7d: aggregate.activeUsers7d,
        totalTimeSpentSeconds,
      },
      members: memberRows,
      activityTimeline: this.zeroFilledTimeline(ANALYTICS_TIMELINE_DAYS, activityRows),
    };
  }

  /**
   * Full per-user analytics. Allowed: self (any role), SUPER_ADMIN, or a TRAINER whose groups
   * include the user. Unknown user is a 404 for any caller; an existing-but-not-visible user
   * is a 403 (mirrors the Q&A module's deliberate 404-vs-403 distinction).
   */
  async getUserAnalytics(userId: string, actor: Actor): Promise<UserAnalytics> {
    const isSelf = actor.id === userId;
    const selfSnapshotPromise = isSelf ? this.aggregation.ensureUserSnapshots([userId]) : null;
    const user = await this.repository.findUserWithGroups(userId);
    if (!user) throw new NotFoundError('User not found.');

    if (!isSelf && actor.role !== 'SUPER_ADMIN') {
      const visible =
        actor.role === 'TRAINER' && (await this.repository.isTraineeVisibleToTrainer(userId, actor.id));
      if (!visible) throw new ForbiddenError("You don't have permission to view this user's analytics.");
    }

    const [snapshot] = selfSnapshotPromise
      ? await selfSnapshotPromise
      : await this.aggregation.ensureUserSnapshots([userId]);
    // ensureUserSnapshots upserts a row for every existing user, so this only guards races.
    if (!snapshot) throw new NotFoundError('User analytics are not available.');

    const today = toUtcDayString(new Date());
    // One fetch covers both needs: the streak lookback window is a superset of the 90-day view.
    const streakStart = utcDayToDate(addUtcDays(today, -(ANALYTICS_STREAK_LOOKBACK_DAYS - 1)));
    const [activityRows, courseRows, recentAttempts, aiUsage, qnaActivity] = await Promise.all([
      this.repository.findDailyActivityForUsers([userId], streakStart),
      this.buildUserCourseRows(userId),
      this.buildRecentAttemptRows(userId),
      this.repository.countAiUsage(userId),
      this.repository.countQnaActivity(userId),
    ]);
    const streakDays = computeStreakDays(new Set(activityRows.map((row) => toUtcDayString(row.date))), today);

    return {
      user: {
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        departmentName: user.department?.name ?? null,
        groupNames: user.groupMemberships.map((membership) => membership.group.name),
        lastLogin: user.lastLogin,
      },
      performance: {
        coursesAssigned: snapshot.coursesAssigned,
        coursesCompleted: snapshot.coursesCompleted,
        lessonsCompleted: snapshot.lessonsCompleted,
        totalAssignedLessons: snapshot.totalAssignedLessons,
        completionPercentage: snapshot.completionPercentage,
        timeSpentSeconds: snapshot.timeSpentSeconds,
        assessmentsAssigned: snapshot.assessmentsAssigned,
        assessmentsTaken: snapshot.assessmentsTaken,
        assessmentsPassed: snapshot.assessmentsPassed,
        averageScore: snapshot.averageScore,
        activityEvents7d: snapshot.activityEvents7d,
        performanceScore: snapshot.performanceScore,
        lastActivityAt: snapshot.lastActivityAt,
        computedAt: snapshot.computedAt,
      },
      streakDays,
      courses: courseRows,
      recentAttempts,
      dailyActivity: this.zeroFilledTimeline(ANALYTICS_ACTIVITY_WINDOW_DAYS, activityRows),
      aiUsage,
      qnaActivity,
    };
  }

  /** The caller's own analytics — every role may call this. */
  getMyAnalytics(actor: Actor): Promise<UserAnalytics> {
    return this.getUserAnalytics(actor.id, actor);
  }

  /**
   * Ranked trainees by performanceScore. Population: TRAINER → distinct TRAINEE members of
   * their groups (403 when filtering by a group that isn't theirs); SUPER_ADMIN → all active
   * trainees. Optional group/department/course filters intersect the population.
   */
  async getLeaderboard(
    filters: LeaderboardFilters,
    actor: Actor,
    knownTrainerGroupIds?: string[],
  ): Promise<LeaderboardEntry[]> {
    const limit = Math.min(Math.max(filters.limit ?? LEADERBOARD_DEFAULT_LIMIT, 1), LEADERBOARD_MAX_LIMIT);

    let trainerGroupIds: string[] | undefined;
    if (actor.role !== 'SUPER_ADMIN') {
      trainerGroupIds = knownTrainerGroupIds ?? (await this.repository.findTrainerGroupIds(actor.id));
      if (filters.groupId && !trainerGroupIds.includes(filters.groupId)) {
        throw new ForbiddenError("You don't have permission to view this group's leaderboard.");
      }
      if (!trainerGroupIds.length) return [];
    }

    const population = await this.repository.findLeaderboardPopulation({
      trainerGroupIds,
      groupId: filters.groupId,
      departmentId: filters.departmentId,
      courseId: filters.courseId,
    });

    const userIds = population.map((user) => user.id);
    const snapshots = await this.aggregation.ensureUserSnapshots(userIds);
    const snapshotByUser = new Map(snapshots.map((snapshot) => [snapshot.userId, snapshot]));

    return population
      .map((user) => {
        const snapshot = snapshotByUser.get(user.id);
        return {
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          groupNames: user.groupMemberships.map((membership) => membership.group.name),
          completionPercentage: snapshot?.completionPercentage ?? 0,
          averageScore: snapshot?.averageScore ?? null,
          activityEvents7d: snapshot?.activityEvents7d ?? 0,
          performanceScore: snapshot?.performanceScore ?? 0,
        };
      })
      .sort(
        (a, b) =>
          b.performanceScore - a.performanceScore ||
          b.completionPercentage - a.completionPercentage ||
          a.name.localeCompare(b.name),
      )
      .slice(0, limit)
      .map((entry, index) => ({ rank: index + 1, ...entry }));
  }

  /**
   * Course analytics are content-level and staff-wide (TRAINER or SUPER_ADMIN, via the route) —
   * courses aren't per-trainer entities in this schema (any trainer may author/assign any
   * course, Prompt 5), so the per-trainer scoping deliberately does NOT apply here. User/group
   * analytics are where the stricter trainer scoping bites.
   */
  async getCourseAnalytics(courseId: string, _actor: Actor): Promise<CourseAnalytics> {
    const course = await this.repository.findCourseSummary(courseId);
    if (!course) throw new NotFoundError('Course not found.');

    await this.aggregation.ensureCourseSnapshot(courseId);
    const snapshot = await this.repository.findCourseSnapshot(courseId);
    if (!snapshot) throw new NotFoundError('Course analytics are not available.');

    return {
      course: { courseId: course.id, title: course.title, status: course.status },
      assignedTrainees: snapshot.assignedTrainees,
      startedCount: snapshot.startedCount,
      completedCount: snapshot.completedCount,
      completionRate: snapshot.completionRate,
      averageTimeSpentSeconds: snapshot.averageTimeSpentSeconds,
      averageScore: snapshot.averageScore,
      lessonFunnel: (snapshot.lessonFunnel as unknown as LessonFunnelStep[] | null) ?? [],
      computedAt: snapshot.computedAt,
    };
  }

  /** Same content-level, staff-wide pattern as getCourseAnalytics. */
  async getAssessmentAnalytics(assessmentId: string, _actor: Actor): Promise<AssessmentAnalytics> {
    const assessment = await this.repository.findAssessmentSummary(assessmentId);
    if (!assessment) throw new NotFoundError('Assessment not found.');

    await this.aggregation.ensureAssessmentSnapshot(assessmentId);
    const snapshot = await this.repository.findAssessmentSnapshot(assessmentId);
    if (!snapshot) throw new NotFoundError('Assessment analytics are not available.');

    return {
      assessment: { assessmentId: assessment.id, title: assessment.title, status: assessment.status },
      assignedTrainees: snapshot.assignedTrainees,
      attemptedCount: snapshot.attemptedCount,
      submittedCount: snapshot.submittedCount,
      gradedCount: snapshot.gradedCount,
      participationRate: snapshot.participationRate,
      averageScore: snapshot.averageScore,
      passRate: snapshot.passRate,
      questionStats: (snapshot.questionStats as unknown as AssessmentQuestionStat[] | null) ?? [],
      weakTopics: (snapshot.weakTopics as unknown as AssessmentWeakTopic[] | null) ?? [],
      computedAt: snapshot.computedAt,
    };
  }

  /** Force-refresh every snapshot. Route-gated to SUPER_ADMIN; re-checked here as defense in depth. */
  refresh(actor: Actor): Promise<RefreshResult> {
    if (actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError("You don't have permission to perform this action.");
    }
    return this.aggregation.refreshAll();
  }

  /** Live aggregate over a set of member snapshots — group metrics per the schema's design note. */
  private aggregateMemberSnapshots(snapshots: UserPerformanceSnapshot[]): {
    completionPercentage: number;
    averageScore: number | null;
    activeUsers7d: number;
    lastActivityAt: Date | null;
  } {
    const completionPercentage = round1(
      mean(snapshots.map((snapshot) => snapshot.completionPercentage)) ?? 0,
    );

    const scores = snapshots
      .map((snapshot) => snapshot.averageScore)
      .filter((value): value is number => value !== null);
    const rawAverageScore = mean(scores);
    const averageScore = rawAverageScore === null ? null : round1(rawAverageScore);

    const sevenDaysAgo = Date.now() - 7 * MS_PER_DAY;
    const activeUsers7d = snapshots.filter(
      (snapshot) => snapshot.lastActivityAt !== null && snapshot.lastActivityAt.getTime() >= sevenDaysAgo,
    ).length;

    let lastActivityAt: Date | null = null;
    for (const snapshot of snapshots) {
      if (snapshot.lastActivityAt && (!lastActivityAt || snapshot.lastActivityAt > lastActivityAt)) {
        lastActivityAt = snapshot.lastActivityAt;
      }
    }

    return { completionPercentage, averageScore, activeUsers7d, lastActivityAt };
  }

  /** Sums rows per UTC day (across users) and zero-fills the trailing `days` days ending today. */
  private zeroFilledTimeline(
    days: number,
    rows: Array<DailyActivityCounts & { date: Date }>,
  ): DailyActivityPoint[] {
    const byDate = new Map<string, DailyActivityPoint>();
    for (const row of rows) {
      const date = toUtcDayString(row.date);
      const point = byDate.get(date) ?? {
        date,
        logins: 0,
        lessonsCompleted: 0,
        assessmentsSubmitted: 0,
        aiMessages: 0,
        qnaPosts: 0,
      };
      point.logins += row.logins;
      point.lessonsCompleted += row.lessonsCompleted;
      point.assessmentsSubmitted += row.assessmentsSubmitted;
      point.aiMessages += row.aiMessages;
      point.qnaPosts += row.qnaPosts;
      byDate.set(date, point);
    }

    const today = toUtcDayString(new Date());
    const points: DailyActivityPoint[] = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = addUtcDays(today, -offset);
      points.push(
        byDate.get(date) ?? {
          date,
          logins: 0,
          lessonsCompleted: 0,
          assessmentsSubmitted: 0,
          aiMessages: 0,
          qnaPosts: 0,
        },
      );
    }
    return points;
  }

  /** The user's accessible courses with per-course completion/status/time-spent. */
  private async buildUserCourseRows(userId: string): Promise<UserCourseAnalyticsRow[]> {
    const courses = await this.repository.findAccessibleCoursesWithProgress(userId);
    return courses.map((course) => {
      const lessons = course.modules.flatMap((module) => module.lessons);
      const tally = lessons.reduce(
        (result, lesson) => {
          result.total += 1;
          const progress = lesson.progress[0];
          if (progress) {
            result.started += 1;
            result.timeSpentSeconds += progress.timeSpentSeconds;
            if (progress.status === 'COMPLETED') result.completed += 1;
          }
          return result;
        },
        { total: 0, completed: 0, started: 0, timeSpentSeconds: 0 },
      );
      const status: UserCourseAnalyticsRow['status'] =
        tally.total > 0 && tally.completed === tally.total
          ? 'COMPLETED'
          : tally.started === 0
            ? 'NOT_STARTED'
            : 'IN_PROGRESS';
      return {
        courseId: course.id,
        title: course.title,
        completionPercentage: percentage(tally.completed, tally.total),
        status,
        timeSpentSeconds: tally.timeSpentSeconds,
      };
    });
  }

  private async buildRecentAttemptRows(userId: string): Promise<UserRecentAttemptRow[]> {
    const attempts = await this.repository.findRecentAttemptsForUser(userId, 10);
    return attempts.map((attempt) => ({
      attemptId: attempt.id,
      assessmentId: attempt.assessmentId,
      assessmentTitle: attempt.assessment.title,
      status: attempt.status,
      percentage: attempt.percentage,
      passed: attempt.passed,
      submittedAt: attempt.submittedAt,
    }));
  }
}

export const analyticsService = new AnalyticsService();
