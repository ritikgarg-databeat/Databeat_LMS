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
  LiveAnalyticsFilters,
  LiveAnalyticsOverview,
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
  private readonly overviewCache = new Map<string, { expiresAt: number; value: LiveAnalyticsOverview }>();
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

  async getOverview(actor: Actor, filters: LiveAnalyticsFilters): Promise<LiveAnalyticsOverview> {
    const cacheKey = `${actor.role}:${actor.id}:${JSON.stringify(filters)}`;
    const cached = this.overviewCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const trainerGroupIds =
      actor.role === 'SUPER_ADMIN' ? undefined : await this.repository.findTrainerGroupIds(actor.id);
    if (filters.groupId && trainerGroupIds && !trainerGroupIds.includes(filters.groupId)) {
      throw new ForbiddenError("You don't have permission to view this group's analytics.");
    }

    const [population, allGroups, courses, assessments] = await Promise.all([
      this.repository.findLeaderboardPopulation({
        trainerGroupIds,
        groupId: filters.groupId,
        departmentId: filters.departmentId,
        courseId: filters.courseId,
        assessmentId: filters.assessmentId,
      }),
      this.getGroupsAnalytics(actor, { departmentId: filters.departmentId }),
      this.repository.findOverviewCourses({
        trainerGroupIds,
        groupId: filters.groupId,
        courseId: filters.courseId,
      }),
      this.repository.findOverviewAssessments({
        trainerGroupIds,
        groupId: filters.groupId,
        assessmentId: filters.assessmentId,
      }),
    ]);

    const userIds = population.map((user) => user.id);
    const sinceDay = addUtcDays(toUtcDayString(new Date()), -(filters.rangeDays - 1));
    const since = utcDayToDate(sinceDay);
    const snapshots = await this.aggregation.ensureUserSnapshots(userIds);
    const snapshotByUser = new Map(snapshots.map((snapshot) => [snapshot.userId, snapshot]));

    const courseIds = courses.map((course) => course.id);
    const assessmentIds = assessments.map((assessment) => assessment.id);
    const [
      activityRows,
      courseAssignments,
      courseLessons,
      assessmentAssignments,
      assessmentAttempts,
      integrityCounts,
    ] = await Promise.all([
      this.repository.findDailyActivityForUsers(userIds, since),
      this.repository.findCourseAssignmentsForUsers(
        courseIds,
        userIds,
        filters.groupId ? [filters.groupId] : trainerGroupIds,
      ),
      this.repository.findCourseLessonsWithProgress(courseIds, userIds),
      this.repository.findAssessmentAssignmentsForUsers(
        assessmentIds,
        userIds,
        filters.groupId ? [filters.groupId] : trainerGroupIds,
      ),
      this.repository.findAssessmentAttemptsForUsers(assessmentIds, userIds),
      this.repository.findIntegrityEventCounts(userIds, since, filters.assessmentId),
    ]);

    const assignedCourseUsers = new Map<string, Set<string>>();
    const mandatoryCourseUsers = new Map<string, Set<string>>();
    for (const assignment of courseAssignments) {
      const users = assignedCourseUsers.get(assignment.courseId) ?? new Set<string>();
      assignment.group.members.forEach((member) => users.add(member.userId));
      assignedCourseUsers.set(assignment.courseId, users);
      if (assignment.isMandatory) {
        const mandatoryUsers = mandatoryCourseUsers.get(assignment.courseId) ?? new Set<string>();
        assignment.group.members.forEach((member) => mandatoryUsers.add(member.userId));
        mandatoryCourseUsers.set(assignment.courseId, mandatoryUsers);
      }
    }
    const lessonsByCourse = new Map<string, typeof courseLessons>();
    for (const lesson of courseLessons) {
      const lessons = lessonsByCourse.get(lesson.module.courseId) ?? [];
      lessons.push(lesson);
      lessonsByCourse.set(lesson.module.courseId, lessons);
    }
    const courseRows = courses.map((course) => {
      const assignedUsers = assignedCourseUsers.get(course.id) ?? new Set<string>();
      const mandatoryUsers = mandatoryCourseUsers.get(course.id) ?? new Set<string>();
      const lessons = lessonsByCourse.get(course.id) ?? [];
      let startedCount = 0;
      let completedCount = 0;
      let mandatoryStartedCount = 0;
      let mandatoryCompletedCount = 0;
      for (const userId of assignedUsers) {
        const progress = lessons.map((lesson) => lesson.progress.find((row) => row.userId === userId));
        const started = progress.some(Boolean);
        const completed =
          lessons.length > 0 &&
          lessons.every((lesson, index) => {
            const row = progress[index];
            return row?.status === 'COMPLETED' && row.completedContentVersion === lesson.contentVersion;
          });
        if (started) startedCount += 1;
        if (completed) completedCount += 1;
        if (mandatoryUsers.has(userId)) {
          if (started) mandatoryStartedCount += 1;
          if (completed) mandatoryCompletedCount += 1;
        }
      }
      return {
        courseId: course.id,
        title: course.title,
        isMandatory: mandatoryUsers.size > 0,
        assignedTrainees: assignedUsers.size,
        startedCount,
        completedCount,
        completionRate: percentage(completedCount, assignedUsers.size),
        averageScore: null,
        mandatoryAssignedTrainees: mandatoryUsers.size,
        mandatoryStartedCount,
        mandatoryCompletedCount,
      };
    });
    const assignedAssessmentUsers = new Map<string, Set<string>>();
    for (const assignment of assessmentAssignments) {
      const users = assignedAssessmentUsers.get(assignment.assessmentId) ?? new Set<string>();
      assignment.group.members.forEach((member) => users.add(member.userId));
      assignedAssessmentUsers.set(assignment.assessmentId, users);
    }
    const latestAttemptByAssessmentUser = new Map<string, (typeof assessmentAttempts)[number]>();
    for (const attempt of assessmentAttempts) {
      const key = `${attempt.assessmentId}:${attempt.userId}`;
      if (!latestAttemptByAssessmentUser.has(key)) latestAttemptByAssessmentUser.set(key, attempt);
    }
    const assessmentRows = assessments.map((assessment) => {
      const assignedUsers = assignedAssessmentUsers.get(assessment.id) ?? new Set<string>();
      const attempts = [...assignedUsers]
        .map((userId) => latestAttemptByAssessmentUser.get(`${assessment.id}:${userId}`))
        .filter((attempt): attempt is NonNullable<typeof attempt> => Boolean(attempt));
      const scores = attempts
        .map((attempt) => attempt.percentage)
        .filter((score): score is number => score !== null);
      const graded = attempts.filter((attempt) => attempt.passed !== null);
      return {
        assessmentId: assessment.id,
        title: assessment.title,
        assignedTrainees: assignedUsers.size,
        participationRate: percentage(attempts.length, assignedUsers.size),
        averageScore: scores.length ? round1(mean(scores) ?? 0) : null,
        passRate: graded.length
          ? percentage(graded.filter((attempt) => attempt.passed).length, graded.length)
          : null,
      };
    });

    const scored = snapshots
      .map((snapshot) => snapshot.averageScore)
      .filter((score): score is number => score !== null);
    const activeCutoff = Date.now() - filters.rangeDays * MS_PER_DAY;
    const mandatoryRows = courseRows.filter((course) => course.isMandatory);
    const mandatoryAssigned = mandatoryRows.reduce(
      (sum, course) => sum + course.mandatoryAssignedTrainees,
      0,
    );
    const mandatoryCompleted = mandatoryRows.reduce((sum, course) => sum + course.mandatoryCompletedCount, 0);

    const leaderboard = population
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
        (a, b) => b.performanceScore - a.performanceScore || b.completionPercentage - a.completionPercentage,
      )
      .slice(0, 10)
      .map((entry, index) => ({ rank: index + 1, ...entry }));

    const value: LiveAnalyticsOverview = {
      generatedAt: new Date(),
      rangeDays: filters.rangeDays,
      summary: {
        totalTrainees: population.length,
        activeTrainees: snapshots.filter(
          (snapshot) => snapshot.lastActivityAt && snapshot.lastActivityAt.getTime() >= activeCutoff,
        ).length,
        learningHours: round1(snapshots.reduce((sum, snapshot) => sum + snapshot.timeSpentSeconds, 0) / 3600),
        averageCompletion: round1(mean(snapshots.map((snapshot) => snapshot.completionPercentage)) ?? 0),
        averageScore: scored.length ? round1(mean(scored) ?? 0) : null,
        passRate: snapshots.reduce((sum, snapshot) => sum + snapshot.assessmentsTaken, 0)
          ? percentage(
              snapshots.reduce((sum, snapshot) => sum + snapshot.assessmentsPassed, 0),
              snapshots.reduce((sum, snapshot) => sum + snapshot.assessmentsTaken, 0),
            )
          : null,
        mandatoryCompletion: percentage(mandatoryCompleted, mandatoryAssigned),
      },
      activityTimeline: this.zeroFilledTimeline(filters.rangeDays, activityRows),
      completionDistribution: [
        {
          status: 'NOT_STARTED',
          count: snapshots.filter((snapshot) => snapshot.completionPercentage === 0).length,
        },
        {
          status: 'IN_PROGRESS',
          count: snapshots.filter(
            (snapshot) => snapshot.completionPercentage > 0 && snapshot.completionPercentage < 100,
          ).length,
        },
        {
          status: 'COMPLETED',
          count: snapshots.filter((snapshot) => snapshot.completionPercentage === 100).length,
        },
      ],
      groups: filters.groupId ? allGroups.filter((group) => group.groupId === filters.groupId) : allGroups,
      courses: courseRows.map(
        ({
          mandatoryAssignedTrainees: _assigned,
          mandatoryStartedCount: _started,
          mandatoryCompletedCount: _completed,
          ...course
        }) => course,
      ),
      assessments: assessmentRows,
      mandatoryCompliance: mandatoryRows.map((course) => ({
        courseId: course.courseId,
        title: course.title,
        assigned: course.mandatoryAssignedTrainees,
        completed: course.mandatoryCompletedCount,
        inProgress: Math.max(0, course.mandatoryStartedCount - course.mandatoryCompletedCount),
        notStarted: Math.max(0, course.mandatoryAssignedTrainees - course.mandatoryStartedCount),
        completionRate: percentage(course.mandatoryCompletedCount, course.mandatoryAssignedTrainees),
      })),
      leaderboard,
      atRiskTrainees: population
        .map((user) => ({ user, snapshot: snapshotByUser.get(user.id) }))
        .filter(({ snapshot }) =>
          Boolean(
            snapshot &&
            (snapshot.completionPercentage < 50 ||
              !snapshot.lastActivityAt ||
              snapshot.lastActivityAt.getTime() < Date.now() - 7 * MS_PER_DAY),
          ),
        )
        .sort((a, b) => (a.snapshot?.performanceScore ?? 0) - (b.snapshot?.performanceScore ?? 0))
        .slice(0, 10)
        .map(({ user, snapshot }) => ({
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          completionPercentage: snapshot?.completionPercentage ?? 0,
          averageScore: snapshot?.averageScore ?? null,
          lastActivityAt: snapshot?.lastActivityAt ?? null,
        })),
      integrityEvents: integrityCounts.map((entry) => ({ type: entry.type, count: entry._count._all })),
    };

    this.overviewCache.set(cacheKey, { value, expiresAt: Date.now() + 60_000 });
    return value;
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
  async getCourseAnalytics(courseId: string, actor: Actor): Promise<CourseAnalytics> {
    const course = await this.repository.findCourseSummary(courseId);
    if (!course) throw new NotFoundError('Course not found.');
    if (actor.role === 'TRAINER' && course.createdById !== actor.id) {
      throw new ForbiddenError(
        'Organization-wide course analytics are available only to the course owner. Use Team Performance for your groups.',
      );
    }

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
  async getAssessmentAnalytics(assessmentId: string, actor: Actor): Promise<AssessmentAnalytics> {
    const assessment = await this.repository.findAssessmentSummary(assessmentId);
    if (!assessment) throw new NotFoundError('Assessment not found.');
    if (actor.role === 'TRAINER' && assessment.createdById !== actor.id) {
      throw new ForbiddenError(
        'Organization-wide assessment analytics are available only to the assessment owner. Use Team Performance for your groups.',
      );
    }

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
            if (progress.status === 'COMPLETED' && progress.completedContentVersion === lesson.contentVersion)
              result.completed += 1;
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
        isMandatory: course.groupAssignments.length > 0,
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
