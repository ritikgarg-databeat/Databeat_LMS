import type { Course, Role } from '@prisma/client';

import { DepartmentsRepository } from '@/modules/departments/departments.repository';
import { ExperienceLevelsRepository } from '@/modules/experience-levels/experience-levels.repository';
import { GroupsRepository } from '@/modules/groups/groups.repository';
import { notificationsService } from '@/modules/notifications';
import { auditLogService } from '@/services/audit-log.service';
import { BaseService } from '@/services/base.service';
import type { PaginatedData } from '@/types/common';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/utils/app-error';
import { logger } from '@/utils/logger';
import { buildPaginationMeta } from '@/utils/pagination.util';

import type { AssignGroupDto, CreateCourseDto, DuplicateCourseDto, UpdateCourseDto, UpdateCourseStatusDto } from './courses.dto';
import { CoursesRepository, type CourseDetail } from './courses.repository';
import type { CourseListFilters, CourseSortField, CourseStats, SortOrder } from './courses.types';

interface Actor {
  id: string;
  role: Role;
}

// Business logic for the courses module. Controllers call into this layer only.
export class CoursesService extends BaseService {
  constructor(
    protected readonly repository: CoursesRepository = new CoursesRepository(),
    private readonly departmentsRepository: DepartmentsRepository = new DepartmentsRepository(),
    private readonly experienceLevelsRepository: ExperienceLevelsRepository = new ExperienceLevelsRepository(),
    private readonly groupsRepository: GroupsRepository = new GroupsRepository(),
  ) {
    super();
  }

  async list(
    filters: CourseListFilters,
    page: number,
    pageSize: number,
    sortBy: CourseSortField,
    sortOrder: SortOrder,
  ): Promise<PaginatedData<unknown>> {
    const { items, total } = await this.repository.findMany(filters, (page - 1) * pageSize, pageSize, sortBy, sortOrder);

    const mapped = items.map((course) => {
      const { modules, _count, ...rest } = course;
      const lessonCount = modules.reduce((sum, courseModule) => sum + courseModule._count.lessons, 0);
      return {
        ...rest,
        moduleCount: _count.modules,
        lessonCount,
        assignedGroupsCount: _count.groupAssignments,
      };
    });

    return { items: mapped, meta: buildPaginationMeta(page, pageSize, total) };
  }

  async getStats(): Promise<CourseStats> {
    const [totalCourses, publishedCourses, draftCourses, archivedCourses, assignedGroupsCount, activeLearners] = await Promise.all([
      this.repository.countAll(),
      this.repository.countByStatus('PUBLISHED'),
      this.repository.countByStatus('DRAFT'),
      this.repository.countByStatus('ARCHIVED'),
      this.repository.countAssignedGroups(),
      this.repository.countActiveLearners(),
    ]);
    return { totalCourses, publishedCourses, draftCourses, archivedCourses, assignedGroupsCount, activeLearners };
  }

  /**
   * A trainee's (or any user's) assigned + published courses, annotated with a computed
   * completion percentage. Returns an empty list — not an error — for a user with no group
   * memberships or no assigned courses (Prompt 5 § GET /courses/mine).
   */
  async listMine(userId: string) {
    const courseIds = await this.repository.findAssignedCourseIds(userId);
    if (courseIds.length === 0) return [];

    const courses = await this.repository.findManyForLearner(courseIds);

    return Promise.all(
      courses.map(async (course) => {
        const { modules, ...rest } = course;
        const lessonIds = modules.flatMap((courseModule) => courseModule.lessons.map((lesson) => lesson.id));
        const lessonCount = lessonIds.length;
        const completedCount = await this.repository.countCompletedLessons(userId, lessonIds);
        const completionPercentage = lessonCount === 0 ? 0 : Math.round((completedCount / lessonCount) * 100);

        return {
          ...rest,
          moduleCount: modules.length,
          lessonCount,
          completionPercentage,
        };
      }),
    );
  }

  async getById(id: string, actor: Actor) {
    const course = await this.repository.findDetailById(id);

    if (actor.role === 'TRAINEE') {
      if (!course) throw new ForbiddenError("You don't have permission to view this course.");
      const accessible = await this.repository.isAccessibleToUser(id, actor.id);
      if (!accessible) throw new ForbiddenError("You don't have permission to view this course.");
      return this.toDetailDto(course, true);
    }

    if (!course) throw new NotFoundError('Course not found.');
    return this.toDetailDto(course, false);
  }

  async create(dto: CreateCourseDto, actorId: string, ipAddress?: string | null): Promise<Course> {
    if (dto.departmentId) await this.assertDepartmentExists(dto.departmentId);
    if (dto.experienceLevelId) await this.assertExperienceLevelExists(dto.experienceLevelId);

    const created = await this.repository.create({
      title: dto.title,
      description: dto.description,
      thumbnail: dto.thumbnail,
      ...(dto.departmentId ? { department: { connect: { id: dto.departmentId } } } : {}),
      ...(dto.experienceLevelId ? { experienceLevel: { connect: { id: dto.experienceLevelId } } } : {}),
      estimatedDurationMinutes: dto.estimatedDurationMinutes,
      difficulty: dto.difficulty ?? 'BEGINNER',
      status: 'DRAFT',
      createdBy: { connect: { id: actorId } },
    });

    await auditLogService.record({
      action: 'COURSE_CREATED',
      actorId,
      ipAddress,
      metadata: { courseId: created.id, title: created.title },
    });

    return created;
  }

  async update(id: string, dto: UpdateCourseDto, actorId: string, ipAddress?: string | null): Promise<Course> {
    const existing = await this.findOrThrow(id);
    if (dto.departmentId) await this.assertDepartmentExists(dto.departmentId);
    if (dto.experienceLevelId) await this.assertExperienceLevelExists(dto.experienceLevelId);

    const updated = await this.repository.update(id, {
      title: dto.title,
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.thumbnail !== undefined ? { thumbnail: dto.thumbnail } : {}),
      ...(dto.departmentId !== undefined
        ? { department: dto.departmentId ? { connect: { id: dto.departmentId } } : { disconnect: true } }
        : {}),
      ...(dto.experienceLevelId !== undefined
        ? { experienceLevel: dto.experienceLevelId ? { connect: { id: dto.experienceLevelId } } : { disconnect: true } }
        : {}),
      ...(dto.estimatedDurationMinutes !== undefined ? { estimatedDurationMinutes: dto.estimatedDurationMinutes } : {}),
      ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty } : {}),
    });

    await auditLogService.record({
      action: 'COURSE_UPDATED',
      actorId,
      ipAddress,
      metadata: { courseId: existing.id, changes: { ...dto } },
    });

    return updated;
  }

  async updateStatus(id: string, dto: UpdateCourseStatusDto, actorId: string, ipAddress?: string | null): Promise<Course> {
    const existing = await this.findOrThrow(id);
    if (existing.status === dto.status) {
      throw new ConflictError(`Course is already ${dto.status.toLowerCase()}.`);
    }

    const updated = await this.repository.update(id, { status: dto.status });

    await auditLogService.record({
      action: 'COURSE_STATUS_CHANGED',
      actorId,
      ipAddress,
      metadata: { courseId: existing.id, from: existing.status, to: dto.status },
    });

    return updated;
  }

  async softDelete(id: string, actorId: string, ipAddress?: string | null): Promise<void> {
    const existing = await this.findOrThrow(id);
    await this.repository.softDelete(id);

    await auditLogService.record({
      action: 'COURSE_DELETED',
      actorId,
      ipAddress,
      metadata: { courseId: existing.id, title: existing.title },
    });
  }

  async duplicate(id: string, dto: DuplicateCourseDto, actorId: string, ipAddress?: string | null): Promise<Course> {
    await this.findOrThrow(id);

    const created = await this.repository.duplicate(id, dto.title, actorId);

    await auditLogService.record({
      action: 'COURSE_CREATED',
      actorId,
      ipAddress,
      metadata: { courseId: created.id, title: created.title, duplicatedFromId: id },
    });

    return created;
  }

  async listAssignments(courseId: string) {
    await this.findOrThrow(courseId);
    const assignments = await this.repository.listAssignments(courseId);
    return assignments.map((assignment) => ({
      id: assignment.group.id,
      name: assignment.group.name,
      code: assignment.group.code,
      memberCount: assignment.group._count.members,
    }));
  }

  async assignGroup(courseId: string, dto: AssignGroupDto, actorId: string, ipAddress?: string | null) {
    const course = await this.findOrThrow(courseId);
    const group = await this.groupsRepository.findById(dto.groupId);
    if (!group) throw new BadRequestError('Group not found.');

    const existing = await this.repository.findAssignment(courseId, dto.groupId);
    if (existing) throw new ConflictError('This group is already assigned to the course.');

    const created = await this.repository.createAssignment(courseId, dto.groupId, actorId);

    const memberUserIds = await this.repository.findGroupMemberUserIds(dto.groupId);
    if (memberUserIds.length > 0) {
      // Best-effort: the group is already assigned (committed above) — a transient notification
      // failure must not surface as a failed request, since a client retry after such a failure
      // would otherwise hit the `@@unique([courseId, groupId])` conflict on an assignment that
      // actually succeeded the first time. Mirrors assessments.service.ts's `assignGroup`.
      await notificationsService
        .notifyMany(memberUserIds, {
          type: 'COURSE_ASSIGNED',
          title: 'New course assigned',
          message: `"${course.title}" has been assigned to you.`,
          relatedEntityType: 'course',
          relatedEntityId: course.id,
        })
        .catch((error: unknown) => {
          logger.error('Failed to send course-assigned notifications', { error, courseId, groupId: dto.groupId });
        });
    }

    await auditLogService.record({
      action: 'COURSE_ASSIGNED_TO_GROUP',
      actorId,
      ipAddress,
      metadata: { courseId, groupId: dto.groupId },
    });

    return created;
  }

  async unassignGroup(courseId: string, groupId: string, actorId: string, ipAddress?: string | null): Promise<void> {
    await this.findOrThrow(courseId);
    const existing = await this.repository.findAssignment(courseId, groupId);
    if (!existing) throw new NotFoundError('This group is not assigned to the course.');

    await this.repository.deleteAssignment(courseId, groupId);

    await auditLogService.record({
      action: 'COURSE_UNASSIGNED_FROM_GROUP',
      actorId,
      ipAddress,
      metadata: { courseId, groupId },
    });
  }

  private toDetailDto(course: CourseDetail, traineeView: boolean) {
    const { groupAssignments, modules, ...rest } = course;
    const visibleModules = traineeView ? modules.filter((courseModule) => courseModule.isPublished) : modules;

    return {
      ...rest,
      modules: visibleModules.map((courseModule) => ({
        ...courseModule,
        lessons: traineeView ? courseModule.lessons.filter((lesson) => lesson.isPublished) : courseModule.lessons,
      })),
      assignedGroups: groupAssignments.map((assignment) => assignment.group),
    };
  }

  private async findOrThrow(id: string) {
    const course = await this.repository.findById(id);
    if (!course) throw new NotFoundError('Course not found.');
    return course;
  }

  private async assertDepartmentExists(departmentId: string): Promise<void> {
    const department = await this.departmentsRepository.findById(departmentId);
    if (!department) throw new BadRequestError('Department not found.');
  }

  private async assertExperienceLevelExists(experienceLevelId: string): Promise<void> {
    const level = await this.experienceLevelsRepository.findById(experienceLevelId);
    if (!level) throw new BadRequestError('Experience level not found.');
  }
}
