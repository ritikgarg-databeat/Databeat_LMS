import type { Role } from '@prisma/client';

import {
  DASHBOARD_CONTINUE_LEARNING_LIMIT,
  DASHBOARD_RECENT_RESULTS_LIMIT,
  DASHBOARD_UPCOMING_ASSESSMENTS_LIMIT,
  DASHBOARD_UPCOMING_EVENTS_LIMIT,
  DASHBOARD_UPCOMING_EVENTS_WINDOW_DAYS,
} from '@/constants/dashboard-insights';
import { analyticsService, type AnalyticsService, type GroupAnalyticsRow } from '@/modules/analytics';
import { AssessmentsService } from '@/modules/assessments/assessments.service';
import { CalendarService } from '@/modules/calendar/calendar.service';
import { ProgressService } from '@/modules/progress/progress.service';
import { BaseService } from '@/services/base.service';

import { dashboardInsightsService, type DashboardInsightsService } from './dashboard-insights.service';
import { DashboardRepository } from './dashboard.repository';
import type { TraineeDashboard, TrainerDashboard } from './dashboard.types';

interface Actor {
  id: string;
  role: Role;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DASHBOARD_CACHE_TTL_MS = 60_000;

interface CachedDashboard<T> {
  value: T;
  expiresAt: number;
}

/**
 * Business logic for the dashboard module. Controllers call into this layer only.
 *
 * This is an AGGREGATOR, not a source of truth — every field is either reused verbatim from an
 * existing module's already-authorized method (analytics, progress, calendar, assessments) or
 * computed from a small, feature-local query owned by dashboard.repository.ts. See README.md
 * for the full "field → source" table and the reasoning behind each feature-local query.
 */
export class DashboardService extends BaseService {
  private readonly traineeCache = new Map<string, CachedDashboard<TraineeDashboard>>();
  private readonly trainerCache = new Map<string, CachedDashboard<TrainerDashboard>>();
  private readonly traineeInFlight = new Map<string, Promise<TraineeDashboard>>();
  private readonly trainerInFlight = new Map<string, Promise<TrainerDashboard>>();

  constructor(
    protected readonly repository: DashboardRepository = new DashboardRepository(),
    private readonly analytics: AnalyticsService = analyticsService,
    private readonly progress: ProgressService = new ProgressService(),
    private readonly calendar: CalendarService = new CalendarService(),
    private readonly assessments: AssessmentsService = new AssessmentsService(),
    private readonly insights: DashboardInsightsService = dashboardInsightsService,
  ) {
    super();
  }

  /**
   * `GET /dashboard/trainee` — route-gated to TRAINEE only (a personal view), so `actor` here
   * is always the trainee themself; every sub-call below is "my own data", already authorized
   * by the callee (`analyticsService.getMyAnalytics`, `progressService.getContinueLearning`,
   * `calendarService.listMine` are all self-scoped by construction).
   */
  async getTraineeDashboard(actor: Actor): Promise<TraineeDashboard> {
    return this.loadCachedDashboard(
      `${actor.role}:${actor.id}`,
      this.traineeCache,
      this.traineeInFlight,
      () => this.buildTraineeDashboard(actor),
    );
  }

  private async buildTraineeDashboard(actor: Actor): Promise<TraineeDashboard> {
    const userAnalytics = await this.analytics.getMyAnalytics(actor);

    const now = new Date();
    const windowEnd = new Date(now.getTime() + DASHBOARD_UPCOMING_EVENTS_WINDOW_DAYS * MS_PER_DAY);

    const [continueLearningRows, upcomingAssessmentRows, upcomingEventRows, recommendations] =
      await Promise.all([
        this.progress.getContinueLearning(actor.id, DASHBOARD_CONTINUE_LEARNING_LIMIT),
        this.repository.findUpcomingAssessmentsForUser(actor.id, DASHBOARD_UPCOMING_ASSESSMENTS_LIMIT),
        this.calendar.listMine(actor.id, { from: now.toISOString(), to: windowEnd.toISOString() }),
        this.insights.getUserInsights(actor.id, userAnalytics),
      ]);

    return {
      welcome: {
        name: userAnalytics.user.name,
        departmentName: userAnalytics.user.departmentName,
        groupNames: userAnalytics.user.groupNames,
        streakDays: userAnalytics.streakDays,
        overallCompletionPercentage: userAnalytics.performance.completionPercentage,
      },
      continueLearning: continueLearningRows.map((item) => ({
        lessonId: item.lessonId,
        lessonTitle: item.lessonTitle,
        moduleTitle: item.moduleTitle,
        courseId: item.courseId,
        courseTitle: item.courseTitle,
        status: item.status,
        timeSpentSeconds: item.timeSpentSeconds,
        lastViewedAt: item.lastViewedAt,
      })),
      myCourses: userAnalytics.courses.map((course) => ({
        courseId: course.courseId,
        title: course.title,
        isMandatory: course.isMandatory,
        completionPercentage: course.completionPercentage,
        status: course.status,
      })),
      assessments: {
        upcoming: upcomingAssessmentRows.map((assessment) => ({
          assessmentId: assessment.id,
          title: assessment.title,
          dueDate: assessment.dueDate,
        })),
        averageScore: userAnalytics.performance.averageScore,
        taken: userAnalytics.performance.assessmentsTaken,
        passed: userAnalytics.performance.assessmentsPassed,
        recentResults: userAnalytics.recentAttempts
          .slice(0, DASHBOARD_RECENT_RESULTS_LIMIT)
          .map((attempt) => ({
            assessmentId: attempt.assessmentId,
            title: attempt.assessmentTitle,
            percentage: attempt.percentage,
            passed: attempt.passed,
            submittedAt: attempt.submittedAt,
          })),
      },
      upcomingEvents: upcomingEventRows.slice(0, DASHBOARD_UPCOMING_EVENTS_LIMIT).map((event) => ({
        id: event.id,
        title: event.title,
        type: event.type,
        startAt: event.startAt,
      })),
      recommendations,
      qnaActivity: userAnalytics.qnaActivity,
    };
  }

  /**
   * `GET /dashboard/trainer` — route-gated to TRAINER/SUPER_ADMIN. `groups` is already scoped
   * by `analyticsService.getGroupsAnalytics` (TRAINER: own groups only; SUPER_ADMIN: all), so
   * every count derived from it below inherits that same scoping automatically.
   */
  async getTrainerDashboard(actor: Actor): Promise<TrainerDashboard> {
    return this.loadCachedDashboard(
      `${actor.role}:${actor.id}`,
      this.trainerCache,
      this.trainerInFlight,
      () => this.buildTrainerDashboard(actor),
    );
  }

  private async buildTrainerDashboard(actor: Actor): Promise<TrainerDashboard> {
    const groups = await this.analytics.getGroupsAnalytics(actor, {});
    const groupIds = groups.map((group) => group.groupId);
    const isSuperAdmin = actor.role === 'SUPER_ADMIN';

    const [leaderboardEntries, totalTrainees, totalCourses, activeAssessments, assessmentStats, insights] =
      await Promise.all([
        this.analytics.getLeaderboard({ limit: 10 }, actor, groupIds),
        this.repository.countTraineesForGroups(isSuperAdmin ? undefined : groupIds),
        isSuperAdmin ? this.repository.countAllCourses() : this.repository.countCoursesForGroups(groupIds),
        isSuperAdmin
          ? this.repository.countAllPublishedAssessments()
          : this.repository.countActiveAssessmentsForGroups(groupIds),
        this.assessments.getStats(actor),
        this.buildTrainerInsights(groups, actor),
      ]);

    return {
      overview: {
        totalTrainees,
        totalGroups: groups.length,
        totalCourses,
        activeAssessments,
        averageCompletion: this.meanOrZero(groups.map((group) => group.completionPercentage)),
        averageScore: this.meanOrNull(
          groups.map((group) => group.averageScore).filter((score): score is number => score !== null),
        ),
      },
      groups,
      leaderboard: { items: leaderboardEntries },
      insights,
      // getStats applies the same active trainer assessment scope as assessment management.
      pendingGradingCount: assessmentStats.pendingGradingCount,
    };
  }

  /**
   * Trainer-wide insights are synthesized from the trainer's WORST-performing group (lowest
   * completion, tie-broken by lowest average score) rather than one insight per group — a
   * single per-trainer AI/heuristic call that's cheap to cache and still actionable ("here's
   * where to focus first"). No groups → a static, uncached notice (nothing to key a cache
   * entry on yet).
   */
  private async buildTrainerInsights(groups: GroupAnalyticsRow[], actor: Actor) {
    if (groups.length === 0) {
      return {
        source: 'HEURISTIC' as const,
        generatedAt: new Date(),
        insights: [
          {
            kind: 'GENERAL' as const,
            text: 'No groups assigned yet — insights will appear once you have trainees to track.',
          },
        ],
      };
    }

    const worst = groups.reduce((current, candidate) =>
      this.isWorse(candidate, current) ? candidate : current,
    );
    const cached = await this.insights.getFreshGroupInsights(worst.groupId);
    if (cached) return cached;
    const detail = await this.analytics.getGroupAnalytics(worst.groupId, actor);
    return this.insights.getGroupInsights(worst.groupId, detail);
  }

  /** Lowest completionPercentage wins; ties broken by lowest averageScore (nulls treated as 0). */
  private isWorse(candidate: GroupAnalyticsRow, current: GroupAnalyticsRow): boolean {
    if (candidate.completionPercentage !== current.completionPercentage) {
      return candidate.completionPercentage < current.completionPercentage;
    }
    return (candidate.averageScore ?? 0) < (current.averageScore ?? 0);
  }

  private meanOrZero(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  }

  private meanOrNull(values: number[]): number | null {
    if (values.length === 0) return null;
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  }

  /**
   * Dashboards aggregate several independently authorized services. A short per-user cache keeps
   * route changes and duplicate browser requests from repeating the complete query fan-out, while
   * the small TTL keeps newly published learning data visible promptly. Concurrent cache misses
   * share the same promise so a slow database cannot trigger a request stampede.
   */
  private async loadCachedDashboard<T>(
    key: string,
    cache: Map<string, CachedDashboard<T>>,
    inFlight: Map<string, Promise<T>>,
    load: () => Promise<T>,
  ): Promise<T> {
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    if (cached) cache.delete(key);

    const pending = inFlight.get(key);
    if (pending) return pending;

    const request = load()
      .then((value) => {
        cache.set(key, { value, expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS });
        return value;
      })
      .finally(() => inFlight.delete(key));

    inFlight.set(key, request);
    return request;
  }
}

export const dashboardService = new DashboardService();
