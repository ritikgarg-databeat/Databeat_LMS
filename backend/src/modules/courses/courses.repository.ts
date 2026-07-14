import type { CourseStatus, Prisma } from '@prisma/client';

import { BaseRepository } from '@/repositories/base.repository';

import type { CourseListFilters, CourseSortField, SortOrder } from './courses.types';

function buildWhere(filters: CourseListFilters): Prisma.CourseWhereInput {
  const where: Prisma.CourseWhereInput = { deletedAt: null };

  if (filters.status) where.status = filters.status;
  if (filters.difficulty) where.difficulty = filters.difficulty;
  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.experienceLevelId) where.experienceLevelId = filters.experienceLevelId;
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

const summaryInclude = {
  department: { select: { id: true, name: true, code: true } },
  experienceLevel: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.CourseInclude;

// `modules` here is a minimal projection used only to sum lesson counts in the service layer —
// `_count.modules` already gives the module count directly.
const listInclude = {
  ...summaryInclude,
  _count: { select: { groupAssignments: true, modules: true } },
  modules: { select: { _count: { select: { lessons: true } } } },
} satisfies Prisma.CourseInclude;

const detailInclude = {
  ...summaryInclude,
  modules: {
    orderBy: { order: 'asc' },
    include: { lessons: { orderBy: { order: 'asc' } } },
  },
  groupAssignments: {
    include: { group: { select: { id: true, name: true, code: true } } },
  },
} satisfies Prisma.CourseInclude;

const learnerInclude = {
  modules: {
    where: { isPublished: true },
    orderBy: { order: 'asc' },
    include: { lessons: { where: { isPublished: true }, select: { id: true } } },
  },
} satisfies Prisma.CourseInclude;

export type CourseListItem = Prisma.CourseGetPayload<{ include: typeof listInclude }>;
export type CourseDetail = Prisma.CourseGetPayload<{ include: typeof detailInclude }>;
export type CourseForLearner = Prisma.CourseGetPayload<{ include: typeof learnerInclude }>;

// Data-access layer for the courses module. Only this class may query Prisma directly
// (see ARCHITECTURE.md §3.1) — services must go through it, never Prisma directly.
export class CoursesRepository extends BaseRepository {
  async findMany(
    filters: CourseListFilters,
    skip: number,
    take: number,
    sortBy: CourseSortField = 'createdAt',
    sortOrder: SortOrder = 'desc',
  ) {
    const where = buildWhere(filters);
    const [items, total] = await Promise.all([
      this.db.course.findMany({ where, skip, take, orderBy: { [sortBy]: sortOrder }, include: listInclude }),
      this.db.course.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string) {
    return this.db.course.findFirst({ where: { id, deletedAt: null } });
  }

  findDetailById(id: string) {
    return this.db.course.findFirst({ where: { id, deletedAt: null }, include: detailInclude });
  }

  create(data: Prisma.CourseCreateInput) {
    return this.db.course.create({ data, include: summaryInclude });
  }

  update(id: string, data: Prisma.CourseUpdateInput) {
    return this.db.course.update({ where: { id }, data, include: summaryInclude });
  }

  softDelete(id: string) {
    return this.db.course.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * Deep-copies a course's module/lesson structure inside a single transaction so the
   * duplicate is never left partially created. Deliberately does NOT copy LessonResource rows
   * (Prompt 5 § scope decision) or CourseGroupAssignment rows — a duplicate starts unassigned
   * with no resources, re-attached by the trainer.
   */
  async duplicate(sourceId: string, title: string, actorId: string) {
    return this.db.$transaction(async (tx) => {
      const source = await tx.course.findFirstOrThrow({
        where: { id: sourceId, deletedAt: null },
        include: { modules: { orderBy: { order: 'asc' }, include: { lessons: { orderBy: { order: 'asc' } } } } },
      });

      const created = await tx.course.create({
        data: {
          title,
          description: source.description,
          thumbnail: source.thumbnail,
          departmentId: source.departmentId,
          experienceLevelId: source.experienceLevelId,
          estimatedDurationMinutes: source.estimatedDurationMinutes,
          difficulty: source.difficulty,
          status: 'DRAFT',
          createdById: actorId,
        },
      });

      for (const sourceModule of source.modules) {
        const createdModule = await tx.courseModule.create({
          data: {
            courseId: created.id,
            title: sourceModule.title,
            description: sourceModule.description,
            order: sourceModule.order,
            estimatedDurationMinutes: sourceModule.estimatedDurationMinutes,
            isPublished: sourceModule.isPublished,
          },
        });

        if (sourceModule.lessons.length > 0) {
          await tx.lesson.createMany({
            data: sourceModule.lessons.map((lesson) => ({
              moduleId: createdModule.id,
              title: lesson.title,
              description: lesson.description,
              type: lesson.type,
              order: lesson.order,
              estimatedDurationMinutes: lesson.estimatedDurationMinutes,
              isPublished: lesson.isPublished,
            })),
          });
        }
      }

      return tx.course.findUniqueOrThrow({ where: { id: created.id }, include: summaryInclude });
    });
  }

  countAll() {
    return this.db.course.count({ where: { deletedAt: null } });
  }

  countByStatus(status: CourseStatus) {
    return this.db.course.count({ where: { deletedAt: null, status } });
  }

  async countAssignedGroups(): Promise<number> {
    const distinctGroups = await this.db.courseGroupAssignment.findMany({
      distinct: ['groupId'],
      select: { groupId: true },
    });
    return distinctGroups.length;
  }

  async countActiveLearners(): Promise<number> {
    const distinctLearners = await this.db.lessonProgress.findMany({
      where: { status: { not: 'NOT_STARTED' } },
      distinct: ['userId'],
      select: { userId: true },
    });
    return distinctLearners.length;
  }

  listAssignments(courseId: string) {
    return this.db.courseGroupAssignment.findMany({
      where: { courseId },
      orderBy: { assignedAt: 'desc' },
      include: { group: { select: { id: true, name: true, code: true, _count: { select: { members: true } } } } },
    });
  }

  findAssignment(courseId: string, groupId: string) {
    return this.db.courseGroupAssignment.findUnique({ where: { courseId_groupId: { courseId, groupId } } });
  }

  createAssignment(courseId: string, groupId: string, assignedById: string) {
    return this.db.courseGroupAssignment.create({
      data: { courseId, groupId, assignedById },
      include: { group: { select: { id: true, name: true, code: true } } },
    });
  }

  deleteAssignment(courseId: string, groupId: string) {
    return this.db.courseGroupAssignment.delete({ where: { courseId_groupId: { courseId, groupId } } });
  }

  /** userIds of every member of `groupId` — used to fan out the COURSE_ASSIGNED notification. */
  async findGroupMemberUserIds(groupId: string): Promise<string[]> {
    const members = await this.db.groupMember.findMany({ where: { groupId }, select: { userId: true } });
    return members.map((member) => member.userId);
  }

  /** Distinct course ids assigned (via group membership) to `userId` that are currently published. */
  async findAssignedCourseIds(userId: string): Promise<string[]> {
    const memberships = await this.db.groupMember.findMany({ where: { userId }, select: { groupId: true } });
    if (memberships.length === 0) return [];

    const groupIds = memberships.map((membership) => membership.groupId);
    const assignments = await this.db.courseGroupAssignment.findMany({
      where: { groupId: { in: groupIds }, course: { status: 'PUBLISHED', deletedAt: null } },
      distinct: ['courseId'],
      select: { courseId: true },
    });
    return assignments.map((assignment) => assignment.courseId);
  }

  findManyForLearner(courseIds: string[]) {
    return this.db.course.findMany({ where: { id: { in: courseIds } }, include: learnerInclude });
  }

  countCompletedLessons(userId: string, lessonIds: string[]) {
    if (lessonIds.length === 0) return Promise.resolve(0);
    return this.db.lessonProgress.count({ where: { userId, lessonId: { in: lessonIds }, status: 'COMPLETED' } });
  }

  /**
   * Shared access-check rule (Prompt 5 § SECURITY), reused by the lessons/resources/progress
   * modules — keep this name and signature stable. A course is accessible to `userId` if it is
   * published, not deleted, and assigned to a group the user is a member of.
   */
  async isAccessibleToUser(courseId: string, userId: string): Promise<boolean> {
    const course = await this.db.course.findFirst({
      where: { id: courseId, status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
    });
    if (!course) return false;

    const membership = await this.db.groupMember.findFirst({
      where: { userId, group: { courseAssignments: { some: { courseId } } } },
    });
    return membership !== null;
  }
}
