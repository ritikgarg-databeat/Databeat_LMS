import { BaseRepository } from '@/repositories/base.repository';

// Data-access layer for the reports module. Only this class may query Prisma directly (see
// ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly.
//
// This module works directly against the TRANSACTIONAL tables (User/Group/GroupMember/
// CourseGroupAssignment/Lesson/LessonProgress/AssessmentAttempt) and deliberately does NOT
// read the analytics module's snapshot tables or import from '@/modules/analytics' (built in
// parallel): exports must always reflect live data, and feature-local duplication of shared
// rules is this codebase's established convention (see the progress/resources/qna READMEs).
export class ReportsRepository extends BaseRepository {
  /**
   * Ids of the groups a trainer owns (`Group.trainerId`) — the trainer's entire export scope
   * (Prompt 8 § SECURITY). Soft-deleted groups are excluded; ARCHIVED ones are kept, since
   * exports are exactly where historical batches still matter.
   */
  async findTrainerGroupIds(trainerId: string): Promise<string[]> {
    const groups = await this.db.group.findMany({
      where: { trainerId, deletedAt: null },
      select: { id: true },
    });
    return groups.map((group) => group.id);
  }

  /** Every non-deleted group id — the SUPER_ADMIN export scope. */
  async findAllGroupIds(): Promise<string[]> {
    const groups = await this.db.group.findMany({ where: { deletedAt: null }, select: { id: true } });
    return groups.map((group) => group.id);
  }

  findGroupById(groupId: string) {
    return this.db.group.findFirst({ where: { id: groupId, deletedAt: null }, select: { id: true } });
  }

  findCourseById(courseId: string) {
    return this.db.course.findFirst({ where: { id: courseId, deletedAt: null }, select: { id: true } });
  }

  findAssessmentById(assessmentId: string) {
    return this.db.assessment.findFirst({
      where: { id: assessmentId, deletedAt: null },
      select: { id: true },
    });
  }

  /**
   * Distinct TRAINEE members of the given groups, with department and the names of their
   * groups WITHIN the scope — the `Groups` CSV column must never leak a group outside the
   * caller's scope.
   */
  findTraineesInGroups(groupIds: string[]) {
    if (!groupIds.length) return Promise.resolve([]);
    return this.db.user.findMany({
      where: { role: 'TRAINEE', groupMemberships: { some: { groupId: { in: groupIds } } } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        department: { select: { name: true } },
        groupMemberships: {
          where: { groupId: { in: groupIds } },
          select: { group: { select: { name: true } } },
        },
      },
    });
  }

  /** Distinct TRAINEE member ids of the given groups (the results export only needs ids). */
  async findTraineeIdsInGroups(groupIds: string[]): Promise<string[]> {
    if (!groupIds.length) return [];
    const users = await this.db.user.findMany({
      where: { role: 'TRAINEE', groupMemberships: { some: { groupId: { in: groupIds } } } },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  /** Groups (with department + TRAINEE members) for the groups export, sorted by name. */
  findGroupsWithTraineeMembers(groupIds: string[]) {
    if (!groupIds.length) return Promise.resolve([]);
    return this.db.group.findMany({
      where: { id: { in: groupIds } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        department: { select: { name: true } },
        members: {
          where: { user: { role: 'TRAINEE' } },
          select: { user: { select: { id: true, lastLogin: true } } },
        },
      },
    });
  }

  /**
   * All group memberships of the given users, across EVERY group they belong to — deliberately
   * not just the export scope, because course accessibility derives from ANY membership.
   *
   * Together with `findPublishedCourseAssignments`, this is a self-contained copy of the
   * accessible-course rule (Prompt 5 § SECURITY; canonical copy:
   * progress.repository.ts#findAccessibleCourseIds): a course is accessible to a user iff it
   * is PUBLISHED, not soft-deleted, and assigned via CourseGroupAssignment to a group the user
   * is a member of — here batched over many users instead of computed per-user.
   */
  findGroupMembershipsForUsers(userIds: string[]) {
    if (!userIds.length) return Promise.resolve([]);
    return this.db.groupMember.findMany({
      where: { userId: { in: userIds }, group: { status: 'ACTIVE', deletedAt: null } },
      select: { userId: true, groupId: true },
    });
  }

  /** PUBLISHED, non-deleted courses assigned to the given groups (optionally narrowed to one course). */
  findPublishedCourseAssignments(groupIds: string[], courseId?: string) {
    if (!groupIds.length) return Promise.resolve([]);
    return this.db.courseGroupAssignment.findMany({
      where: {
        groupId: { in: groupIds },
        course: { status: 'PUBLISHED', deletedAt: null, ...(courseId ? { id: courseId } : {}) },
      },
      select: { groupId: true, isMandatory: true, course: { select: { id: true, title: true } } },
    });
  }

  /**
   * Published lessons inside published modules of the given courses — the denominator of every
   * completion figure (Prompt 5's formula, same as progress.repository.ts#countLessonsForCourses).
   */
  findPublishedLessonsForCourses(courseIds: string[]) {
    if (!courseIds.length) return Promise.resolve([]);
    return this.db.lesson.findMany({
      where: { isPublished: true, module: { isPublished: true, courseId: { in: courseIds } } },
      select: { id: true, contentVersion: true, module: { select: { courseId: true } } },
    });
  }

  findLessonProgressForUsers(userIds: string[], lessonIds: string[]) {
    if (!userIds.length || !lessonIds.length) return Promise.resolve([]);
    return this.db.lessonProgress.findMany({
      where: { userId: { in: userIds }, lessonId: { in: lessonIds } },
      select: {
        userId: true,
        lessonId: true,
        status: true,
        completedContentVersion: true,
        timeSpentSeconds: true,
        lastViewedAt: true,
      },
    });
  }

  /** Attempts by the given users (on non-deleted assessments), optionally narrowed to one assessment. */
  findAttemptsForUsers(userIds: string[], assessmentId?: string) {
    if (!userIds.length) return Promise.resolve([]);
    return this.db.assessmentAttempt.findMany({
      where: {
        userId: { in: userIds },
        assessment: { deletedAt: null, ...(assessmentId ? { id: assessmentId } : {}) },
      },
      select: {
        status: true,
        totalScore: true,
        percentage: true,
        passed: true,
        timeSpentSeconds: true,
        submittedAt: true,
        user: { select: { firstName: true, lastName: true, email: true } },
        assessment: { select: { title: true } },
      },
    });
  }

  /**
   * Per-user mean AssessmentAttempt.percentage (graded attempts only — `percentage` is null
   * until graded). Filters out attempts on a soft-deleted assessment, matching
   * `findAttemptsForUsers` — without this, the groups export's "Avg Score %" column could
   * include an attempt the results export omits entirely, disagreeing with a sibling export.
   */
  findAverageAttemptPercentageByUser(userIds: string[]) {
    if (!userIds.length) return Promise.resolve([]);
    return this.db.assessmentAttempt.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, percentage: { not: null }, assessment: { deletedAt: null } },
      _avg: { percentage: true },
    });
  }

  /** Distinct users (among `userIds`) with any lesson activity (`lastViewedAt`) since `since`. */
  findUserIdsWithLessonActivitySince(userIds: string[], since: Date) {
    if (!userIds.length) return Promise.resolve([]);
    return this.db.lessonProgress.findMany({
      where: { userId: { in: userIds }, lastViewedAt: { gte: since } },
      select: { userId: true },
      distinct: ['userId'],
    });
  }

  /**
   * PUBLISHED, non-deleted courses with their group-assignment ids, sorted by title.
   * `groupIds === null` means no scope filter (SUPER_ADMIN sees every course); a TRAINER
   * passes their own group ids, restricting to courses assigned to at least one of them.
   */
  findPublishedCoursesWithAssignments(groupIds: string[] | null) {
    if (groupIds !== null && !groupIds.length) return Promise.resolve([]);
    return this.db.course.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        ...(groupIds ? { groupAssignments: { some: { groupId: { in: groupIds } } } } : {}),
      },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        title: true,
        status: true,
        isMandatory: true,
        groupAssignments: { select: { groupId: true } },
      },
    });
  }

  /** (groupId, userId) pairs for TRAINEE members of the given NON-DELETED groups. */
  findTraineeMembershipsForGroups(groupIds: string[]) {
    if (!groupIds.length) return Promise.resolve([]);
    return this.db.groupMember.findMany({
      where: { groupId: { in: groupIds }, group: { deletedAt: null }, user: { role: 'TRAINEE' } },
      select: { groupId: true, userId: true },
    });
  }
}
