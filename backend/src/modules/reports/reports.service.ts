import { BaseService } from '@/services/base.service';
import { ForbiddenError, NotFoundError } from '@/utils/app-error';
import { csvFilename, toCsv, type CsvCell } from '@/utils/csv.util';

import type { ProgressExportQueryDto, ResultsExportQueryDto } from './reports.dto';
import { ReportsRepository } from './reports.repository';
import type {
  AccessibleCourse,
  CsvExport,
  LessonProgressCell,
  ProgressComputation,
  ReportActor,
} from './reports.types';

const PROGRESS_EXPORT_HEADERS = [
  'Trainee Name',
  'Email',
  'Department',
  'Groups',
  'Course',
  'Lessons Completed',
  'Total Lessons',
  'Completion %',
  'Time Spent (hours)',
  'Last Activity',
];

const RESULTS_EXPORT_HEADERS = [
  'Trainee Name',
  'Email',
  'Assessment',
  'Status',
  'Total Score',
  'Percentage',
  'Passed',
  'Time Spent (min)',
  'Submitted At',
];

const GROUPS_EXPORT_HEADERS = [
  'Group',
  'Code',
  'Department',
  'Status',
  'Trainees',
  'Avg Completion %',
  'Avg Score %',
  'Active Last 7 Days',
];

const COURSES_EXPORT_HEADERS = [
  'Course',
  'Status',
  'Assigned Trainees',
  'Started',
  'Completed',
  'Completion Rate %',
  'Avg Time Spent (hours)',
];

const MANDATORY_EXPORT_HEADERS = [
  'Trainee Name',
  'Email',
  'Department',
  'Groups',
  'Mandatory Course',
  'Compliance Status',
  'Lessons Completed',
  'Total Lessons',
  'Compliance %',
  'Last Activity',
];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** `Trainee Name` cell convention everywhere in this module. */
const fullName = (user: { firstName: string; lastName: string }): string =>
  `${user.firstName} ${user.lastName}`;

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Arithmetic mean — callers guard against empty input (a blank cell, not NaN, means "no data"). */
const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

// Business logic for the reports module. Controllers call into this layer only.
//
// Every export follows the same shape: resolve the caller's group-id scope (Prompt 8 §
// SECURITY), load the transactional rows in a fixed number of batched queries, compute the
// figures in memory, and serialize with the shared CSV util. Completion figures reimplement
// the progress module's accessible-course rule + completion formula feature-locally (Prompt 5;
// canonical copies: progress.repository.ts / progress.service.ts) rather than importing across
// modules — this codebase's convention.
export class ReportsService extends BaseService {
  constructor(protected readonly repository: ReportsRepository = new ReportsRepository()) {
    super();
  }

  /** `GET /reports/progress/export` — one row per (trainee-in-scope × accessible course). */
  async exportProgress(actor: ReportActor, query: ProgressExportQueryDto): Promise<CsvExport> {
    const scopeGroupIds = await this.resolveScopedGroupIds(actor, query.groupId);

    if (query.courseId) {
      const course = await this.repository.findCourseById(query.courseId);
      if (!course) throw new NotFoundError('Course not found.');
    }

    const trainees = await this.repository.findTraineesInGroups(scopeGroupIds);
    const computation = await this.loadProgressComputation(
      trainees.map((trainee) => trainee.id),
      query.courseId,
    );

    const rows: CsvCell[][] = [];
    const sortedTrainees = [...trainees].sort((a, b) => fullName(a).localeCompare(fullName(b)));
    for (const trainee of sortedTrainees) {
      const groupNames = trainee.groupMemberships
        .map((membership) => membership.group.name)
        .sort((a, b) => a.localeCompare(b))
        .join('; ');
      const courses = [...(computation.coursesByUser.get(trainee.id) ?? [])].sort((a, b) =>
        a.title.localeCompare(b.title),
      );
      const userProgress = computation.progressByUser.get(trainee.id);

      for (const course of courses) {
        const lessonIds = computation.lessonIdsByCourse.get(course.id) ?? [];
        let completed = 0;
        let timeSpentSeconds = 0;
        let lastActivity: Date | null = null;
        for (const lessonId of lessonIds) {
          const progress = userProgress?.get(lessonId);
          if (!progress) continue;
          if (this.isCurrentCompletion(progress, lessonId, computation.lessonVersionById)) completed += 1;
          timeSpentSeconds += progress.timeSpentSeconds;
          if (progress.lastViewedAt && (!lastActivity || progress.lastViewedAt > lastActivity)) {
            lastActivity = progress.lastViewedAt;
          }
        }

        rows.push([
          fullName(trainee),
          trainee.email,
          trainee.department?.name ?? '',
          groupNames,
          course.title,
          completed,
          lessonIds.length,
          lessonIds.length === 0 ? 0 : Math.round((completed / lessonIds.length) * 100),
          round1(timeSpentSeconds / 3600),
          lastActivity,
        ]);
      }
    }

    return { filename: csvFilename('progress-report'), csv: toCsv(PROGRESS_EXPORT_HEADERS, rows) };
  }

  /** `GET /reports/results/export` — one row per AssessmentAttempt by an in-scope trainee. */
  async exportResults(actor: ReportActor, query: ResultsExportQueryDto): Promise<CsvExport> {
    const scopeGroupIds = await this.resolveScopedGroupIds(actor, query.groupId);

    if (query.assessmentId) {
      const assessment = await this.repository.findAssessmentById(query.assessmentId);
      if (!assessment) throw new NotFoundError('Assessment not found.');
    }

    const traineeIds = await this.repository.findTraineeIdsInGroups(scopeGroupIds);
    const attempts = await this.repository.findAttemptsForUsers(traineeIds, query.assessmentId);

    const sortedAttempts = [...attempts].sort(
      (a, b) =>
        a.assessment.title.localeCompare(b.assessment.title) ||
        fullName(a.user).localeCompare(fullName(b.user)),
    );

    const rows: CsvCell[][] = sortedAttempts.map((attempt) => [
      fullName(attempt.user),
      attempt.user.email,
      attempt.assessment.title,
      attempt.status,
      attempt.totalScore,
      attempt.percentage === null ? null : round1(attempt.percentage),
      attempt.passed === null ? '' : attempt.passed ? 'Yes' : 'No',
      round1(attempt.timeSpentSeconds / 60),
      attempt.submittedAt,
    ]);

    return { filename: csvFilename('assessment-results'), csv: toCsv(RESULTS_EXPORT_HEADERS, rows) };
  }

  /** `GET /reports/groups/export` — one row per group in scope, sorted by group name. */
  async exportGroups(actor: ReportActor): Promise<CsvExport> {
    const scopeGroupIds = await this.resolveScopedGroupIds(actor);
    const groups = await this.repository.findGroupsWithTraineeMembers(scopeGroupIds);

    const memberIds = [...new Set(groups.flatMap((group) => group.members.map((member) => member.user.id)))];

    // The per-member computations below run in memory over a fixed number of batched queries —
    // fine at this scale. If group sizes grow, the upgrade point is a nightly batch job (or the
    // analytics module's snapshot tables) rather than heavier per-request SQL.
    const computation = await this.loadProgressComputation(memberIds);
    const completionByUser = new Map<string, number>();
    for (const userId of memberIds) {
      completionByUser.set(userId, this.overallCompletionPercentage(userId, computation));
    }

    const averageRows = await this.repository.findAverageAttemptPercentageByUser(memberIds);
    const averageScoreByUser = new Map<string, number>();
    for (const row of averageRows) {
      if (row._avg.percentage !== null) averageScoreByUser.set(row.userId, row._avg.percentage);
    }

    const activitySince = new Date(Date.now() - SEVEN_DAYS_MS);
    const recentLessonActivity = new Set(
      (await this.repository.findUserIdsWithLessonActivitySince(memberIds, activitySince)).map(
        (row) => row.userId,
      ),
    );

    const rows: CsvCell[][] = groups.map((group) => {
      const groupMemberIds = group.members.map((member) => member.user.id);
      const completions = groupMemberIds.map((id) => completionByUser.get(id) ?? 0);
      const scores = groupMemberIds
        .map((id) => averageScoreByUser.get(id))
        .filter((value): value is number => value !== undefined);
      const activeCount = group.members.filter(
        (member) =>
          (member.user.lastLogin !== null && member.user.lastLogin >= activitySince) ||
          recentLessonActivity.has(member.user.id),
      ).length;

      return [
        group.name,
        group.code,
        group.department.name,
        group.status,
        groupMemberIds.length,
        completions.length === 0 ? null : round1(mean(completions)),
        scores.length === 0 ? null : round1(mean(scores)),
        activeCount,
      ];
    });

    return { filename: csvFilename('groups-report'), csv: toCsv(GROUPS_EXPORT_HEADERS, rows) };
  }

  /** `GET /reports/courses/export` — one row per published course in scope, sorted by title. */
  async exportCourses(actor: ReportActor): Promise<CsvExport> {
    const trainerGroupIds =
      actor.role === 'TRAINER' ? await this.repository.findTrainerGroupIds(actor.id) : null;
    const courses = await this.repository.findPublishedCoursesWithAssignments(trainerGroupIds);

    // Per course, the groups whose members count as "assigned": ALL assigned groups for a
    // SUPER_ADMIN, only the trainer's own for a TRAINER (Prompt 8 § SECURITY — a trainer's
    // numbers never include trainees from other trainers' groups).
    const trainerGroupIdSet = trainerGroupIds === null ? null : new Set(trainerGroupIds);
    const groupIdsByCourse = new Map<string, string[]>();
    const allGroupIds = new Set<string>();
    for (const course of courses) {
      const ids = course.groupAssignments
        .map((assignment) => assignment.groupId)
        .filter((groupId) => trainerGroupIdSet === null || trainerGroupIdSet.has(groupId));
      groupIdsByCourse.set(course.id, ids);
      for (const id of ids) allGroupIds.add(id);
    }

    const memberships = await this.repository.findTraineeMembershipsForGroups([...allGroupIds]);
    const traineeIdsByGroup = new Map<string, string[]>();
    for (const membership of memberships) {
      const list = traineeIdsByGroup.get(membership.groupId);
      if (list) list.push(membership.userId);
      else traineeIdsByGroup.set(membership.groupId, [membership.userId]);
    }

    const lessons = await this.repository.findPublishedLessonsForCourses(courses.map((course) => course.id));
    const lessonIdsByCourse = this.groupLessonIdsByCourse(lessons);
    const lessonVersionById = new Map(lessons.map((lesson) => [lesson.id, lesson.contentVersion]));

    const allTraineeIds = [...new Set(memberships.map((membership) => membership.userId))];
    const progressRows = await this.repository.findLessonProgressForUsers(
      allTraineeIds,
      lessons.map((lesson) => lesson.id),
    );
    const progressByUser = this.groupProgressByUser(progressRows);

    const rows: CsvCell[][] = courses.map((course) => {
      const assignedIds = [
        ...new Set(
          (groupIdsByCourse.get(course.id) ?? []).flatMap((groupId) => traineeIdsByGroup.get(groupId) ?? []),
        ),
      ];
      const lessonIds = lessonIdsByCourse.get(course.id) ?? [];

      let started = 0;
      let completedTrainees = 0;
      let totalTimeSpentSeconds = 0;
      for (const userId of assignedIds) {
        const userProgress = progressByUser.get(userId);
        let touched = false;
        let completedLessons = 0;
        for (const lessonId of lessonIds) {
          const progress = userProgress?.get(lessonId);
          if (!progress) continue;
          touched = true;
          totalTimeSpentSeconds += progress.timeSpentSeconds;
          if (this.isCurrentCompletion(progress, lessonId, lessonVersionById)) {
            completedLessons += 1;
          }
        }
        if (touched) started += 1;
        // "Completed" requires every published lesson COMPLETED — and at least one lesson,
        // so an empty course never counts as completed.
        if (lessonIds.length > 0 && completedLessons === lessonIds.length) completedTrainees += 1;
      }

      return [
        course.title,
        course.status,
        assignedIds.length,
        started,
        completedTrainees,
        assignedIds.length === 0 ? 0 : Math.round((completedTrainees / assignedIds.length) * 100),
        // Averaged over trainees who actually started — averaging over never-started
        // trainees would just dilute the figure; 0 when nobody has started.
        started === 0 ? 0 : round1(totalTimeSpentSeconds / started / 3600),
      ];
    });

    return { filename: csvFilename('courses-report'), csv: toCsv(COURSES_EXPORT_HEADERS, rows) };
  }

  /** `GET /reports/mandatory/export` - current-version compliance by trainee and mandatory course. */
  async exportMandatoryCompliance(actor: ReportActor): Promise<CsvExport> {
    const scopeGroupIds = await this.resolveScopedGroupIds(actor);
    const trainees = await this.repository.findTraineesInGroups(scopeGroupIds);
    const computation = await this.loadProgressComputation(trainees.map((trainee) => trainee.id));
    const rows: CsvCell[][] = [];

    for (const trainee of [...trainees].sort((a, b) => fullName(a).localeCompare(fullName(b)))) {
      const groupNames = trainee.groupMemberships
        .map((membership) => membership.group.name)
        .sort((a, b) => a.localeCompare(b))
        .join('; ');
      const courses = (computation.coursesByUser.get(trainee.id) ?? [])
        .filter((course) => course.isMandatory)
        .sort((a, b) => a.title.localeCompare(b.title));

      for (const course of courses) {
        const lessonIds = computation.lessonIdsByCourse.get(course.id) ?? [];
        const userProgress = computation.progressByUser.get(trainee.id);
        let completed = 0;
        let started = false;
        let lastActivity: Date | null = null;
        for (const lessonId of lessonIds) {
          const progress = userProgress?.get(lessonId);
          if (!progress) continue;
          started = true;
          if (this.isCurrentCompletion(progress, lessonId, computation.lessonVersionById)) completed += 1;
          if (progress.lastViewedAt && (!lastActivity || progress.lastViewedAt > lastActivity)) {
            lastActivity = progress.lastViewedAt;
          }
        }
        const isComplete = lessonIds.length > 0 && completed === lessonIds.length;
        rows.push([
          fullName(trainee),
          trainee.email,
          trainee.department?.name ?? '',
          groupNames,
          course.title,
          isComplete ? 'COMPLIANT' : started ? 'IN_PROGRESS' : 'NOT_STARTED',
          completed,
          lessonIds.length,
          lessonIds.length === 0 ? 0 : Math.round((completed / lessonIds.length) * 100),
          lastActivity,
        ]);
      }
    }

    return {
      filename: csvFilename('mandatory-training-compliance'),
      csv: toCsv(MANDATORY_EXPORT_HEADERS, rows),
    };
  }

  /**
   * The group-id scope every export operates over (Prompt 8 § SECURITY): all of a TRAINER's
   * own groups (`Group.trainerId`), every group for a SUPER_ADMIN, or the single validated
   * `groupId` when one is passed. A TRAINER asking for a group that isn't theirs gets a 403
   * whether or not it exists (existence is never leaked); a SUPER_ADMIN asking for a
   * nonexistent/deleted group gets a 404.
   */
  private async resolveScopedGroupIds(actor: ReportActor, groupId?: string): Promise<string[]> {
    if (actor.role === 'TRAINER') {
      const ownGroupIds = await this.repository.findTrainerGroupIds(actor.id);
      if (!groupId) return ownGroupIds;
      if (!ownGroupIds.includes(groupId)) {
        throw new ForbiddenError("You don't have permission to export reports for this group.");
      }
      return [groupId];
    }

    if (groupId) {
      const group = await this.repository.findGroupById(groupId);
      if (!group) throw new NotFoundError('Group not found.');
      return [groupId];
    }
    return this.repository.findAllGroupIds();
  }

  /**
   * Loads everything needed to compute per-user / per-course completion, time-spent and
   * last-activity figures for `userIds`, in four batched queries. Implements the
   * accessible-course rule feature-locally (Prompt 5 § SECURITY; canonical copy:
   * progress.repository.ts#findAccessibleCourseIds — see reports.repository.ts).
   */
  private async loadProgressComputation(
    userIds: string[],
    courseIdFilter?: string,
  ): Promise<ProgressComputation> {
    const memberships = await this.repository.findGroupMembershipsForUsers(userIds);
    const membershipGroupIds = [...new Set(memberships.map((membership) => membership.groupId))];
    const assignments = await this.repository.findPublishedCourseAssignments(
      membershipGroupIds,
      courseIdFilter,
    );

    const coursesByGroup = new Map<string, AccessibleCourse[]>();
    const courseIds = new Set<string>();
    for (const assignment of assignments) {
      courseIds.add(assignment.course.id);
      const assignedCourse = { ...assignment.course, isMandatory: assignment.isMandatory };
      const list = coursesByGroup.get(assignment.groupId);
      if (list) list.push(assignedCourse);
      else coursesByGroup.set(assignment.groupId, [assignedCourse]);
    }

    const coursesByUser = new Map<string, AccessibleCourse[]>();
    const seenCourseIdsByUser = new Map<string, Set<string>>();
    for (const membership of memberships) {
      const groupCourses = coursesByGroup.get(membership.groupId);
      if (!groupCourses) continue;
      let seen = seenCourseIdsByUser.get(membership.userId);
      let userCourses = coursesByUser.get(membership.userId);
      if (!seen || !userCourses) {
        seen = new Set();
        userCourses = [];
        seenCourseIdsByUser.set(membership.userId, seen);
        coursesByUser.set(membership.userId, userCourses);
      }
      for (const course of groupCourses) {
        if (seen.has(course.id)) {
          const existing = userCourses.find((entry) => entry.id === course.id);
          if (existing && course.isMandatory) existing.isMandatory = true;
          continue;
        }
        seen.add(course.id);
        userCourses.push(course);
      }
    }

    const lessons = await this.repository.findPublishedLessonsForCourses([...courseIds]);
    const lessonIdsByCourse = this.groupLessonIdsByCourse(lessons);
    const lessonVersionById = new Map(lessons.map((lesson) => [lesson.id, lesson.contentVersion]));

    const progressRows = await this.repository.findLessonProgressForUsers(
      userIds,
      lessons.map((lesson) => lesson.id),
    );
    const progressByUser = this.groupProgressByUser(progressRows);

    return { coursesByUser, lessonIdsByCourse, lessonVersionById, progressByUser };
  }

  /**
   * One user's overall completion — same formula as the progress module's summary (Prompt 5 §
   * PROGRESS TRACKING; canonical copy: progress.service.ts#getSummary): COMPLETED published
   * lessons across all accessible courses / total published lessons, rounded; 0 when no lessons.
   */
  private overallCompletionPercentage(userId: string, computation: ProgressComputation): number {
    const courses = computation.coursesByUser.get(userId) ?? [];
    const lessonIds = courses.flatMap((course) => computation.lessonIdsByCourse.get(course.id) ?? []);
    if (lessonIds.length === 0) return 0;
    const userProgress = computation.progressByUser.get(userId);
    const completed = lessonIds.filter((lessonId) =>
      this.isCurrentCompletion(userProgress?.get(lessonId), lessonId, computation.lessonVersionById),
    ).length;
    return Math.round((completed / lessonIds.length) * 100);
  }

  private groupLessonIdsByCourse(
    lessons: ReadonlyArray<{ id: string; module: { courseId: string } }>,
  ): Map<string, string[]> {
    const lessonIdsByCourse = new Map<string, string[]>();
    for (const lesson of lessons) {
      const list = lessonIdsByCourse.get(lesson.module.courseId);
      if (list) list.push(lesson.id);
      else lessonIdsByCourse.set(lesson.module.courseId, [lesson.id]);
    }
    return lessonIdsByCourse;
  }

  private groupProgressByUser(
    rows: ReadonlyArray<{ userId: string; lessonId: string } & LessonProgressCell>,
  ): Map<string, Map<string, LessonProgressCell>> {
    const progressByUser = new Map<string, Map<string, LessonProgressCell>>();
    for (const row of rows) {
      let userMap = progressByUser.get(row.userId);
      if (!userMap) {
        userMap = new Map();
        progressByUser.set(row.userId, userMap);
      }
      userMap.set(row.lessonId, {
        status: row.status,
        completedContentVersion: row.completedContentVersion,
        timeSpentSeconds: row.timeSpentSeconds,
        lastViewedAt: row.lastViewedAt,
      });
    }
    return progressByUser;
  }

  private isCurrentCompletion(
    progress: LessonProgressCell | undefined,
    lessonId: string,
    lessonVersionById: ReadonlyMap<string, number>,
  ): boolean {
    return (
      progress?.status === 'COMPLETED' && progress.completedContentVersion === lessonVersionById.get(lessonId)
    );
  }
}

export const reportsService = new ReportsService();
