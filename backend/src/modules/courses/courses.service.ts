import type { Course, Role } from '@prisma/client';

import { DepartmentsRepository } from '@/modules/departments/departments.repository';
import { ExperienceLevelsRepository } from '@/modules/experience-levels/experience-levels.repository';
import { GroupsRepository } from '@/modules/groups/groups.repository';
import { notificationsService } from '@/modules/notifications';
import { auditLogService } from '@/services/audit-log.service';
import { BaseService } from '@/services/base.service';
import { storageProvider } from '@/storage';
import type { PaginatedData } from '@/types/common';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/utils/app-error';
import { deleteLessonResourceFiles } from '@/utils/lesson-resource-cleanup.util';
import { logger } from '@/utils/logger';
import { buildPaginationMeta } from '@/utils/pagination.util';
import { deleteVideoDraftFiles } from '@/utils/video-draft-cleanup.util';

import type {
  AssignGroupDto,
  CreateCourseDto,
  DuplicateCourseDto,
  UpdateCourseDto,
  UpdateCourseStatusDto,
} from './courses.dto';
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
    actor: Actor,
    filters: CourseListFilters,
    page: number,
    pageSize: number,
    sortBy: CourseSortField,
    sortOrder: SortOrder,
  ): Promise<PaginatedData<unknown>> {
    const { items, total } = await this.repository.findMany(
      filters,
      (page - 1) * pageSize,
      pageSize,
      sortBy,
      sortOrder,
      actor.role === 'TRAINER' ? actor.id : undefined,
    );

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

  async getStats(actor: Actor): Promise<CourseStats> {
    const trainerId = actor.role === 'TRAINER' ? actor.id : undefined;
    const [
      totalCourses,
      publishedCourses,
      draftCourses,
      archivedCourses,
      assignedGroupsCount,
      activeLearners,
    ] = await Promise.all([
      this.repository.countAll(trainerId),
      this.repository.countByStatus('PUBLISHED', trainerId),
      this.repository.countByStatus('DRAFT', trainerId),
      this.repository.countByStatus('ARCHIVED', trainerId),
      this.repository.countAssignedGroups(trainerId),
      this.repository.countActiveLearners(trainerId),
    ]);
    return {
      totalCourses,
      publishedCourses,
      draftCourses,
      archivedCourses,
      assignedGroupsCount,
      activeLearners,
    };
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
    await this.assertCourseInScope(id, actor);
    return this.toDetailDto(course, false);
  }

  async create(dto: CreateCourseDto, actor: Actor, ipAddress?: string | null): Promise<Course> {
    if (dto.departmentId) await this.assertDepartmentExists(dto.departmentId);
    if (
      actor.role === 'TRAINER' &&
      dto.departmentId &&
      !(await this.groupsRepository.isDepartmentInTrainerScope(actor.id, dto.departmentId))
    ) {
      throw new ForbiddenError("You don't have permission to create a course in this department.");
    }
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
      createdBy: { connect: { id: actor.id } },
    });

    await auditLogService.record({
      action: 'COURSE_CREATED',
      actorId: actor.id,
      ipAddress,
      metadata: { courseId: created.id, title: created.title },
    });

    return created;
  }

  async update(
    id: string,
    dto: UpdateCourseDto,
    actor: Actor,
    ipAddress?: string | null,
  ): Promise<Course> {
    const existing = await this.findOrThrow(id);
    await this.assertCourseInScope(id, actor);
    if (dto.departmentId) await this.assertDepartmentExists(dto.departmentId);
    if (
      actor.role === 'TRAINER' &&
      dto.departmentId &&
      !(await this.groupsRepository.isDepartmentInTrainerScope(actor.id, dto.departmentId))
    ) {
      throw new ForbiddenError("You don't have permission to move this course to that department.");
    }
    if (dto.experienceLevelId) await this.assertExperienceLevelExists(dto.experienceLevelId);

    const updated = await this.repository.update(id, {
      title: dto.title,
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.thumbnail !== undefined ? { thumbnail: dto.thumbnail } : {}),
      ...(dto.departmentId !== undefined
        ? { department: dto.departmentId ? { connect: { id: dto.departmentId } } : { disconnect: true } }
        : {}),
      ...(dto.experienceLevelId !== undefined
        ? {
            experienceLevel: dto.experienceLevelId
              ? { connect: { id: dto.experienceLevelId } }
              : { disconnect: true },
          }
        : {}),
      ...(dto.estimatedDurationMinutes !== undefined
        ? { estimatedDurationMinutes: dto.estimatedDurationMinutes }
        : {}),
      ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty } : {}),
    });

    await auditLogService.record({
      action: 'COURSE_UPDATED',
      actorId: actor.id,
      ipAddress,
      metadata: { courseId: existing.id, changes: { ...dto } },
    });

    return updated;
  }

  async updateStatus(
    id: string,
    dto: UpdateCourseStatusDto,
    actor: Actor,
    ipAddress?: string | null,
  ): Promise<Course> {
    const existing = await this.findOrThrow(id);
    await this.assertCourseInScope(id, actor);
    if (existing.status === dto.status) {
      throw new ConflictError(`Course is already ${dto.status.toLowerCase()}.`);
    }

    const updated = await this.repository.update(id, { status: dto.status });

    await auditLogService.record({
      action: 'COURSE_STATUS_CHANGED',
      actorId: actor.id,
      ipAddress,
      metadata: { courseId: existing.id, from: existing.status, to: dto.status },
    });

    return updated;
  }

  async remove(id: string, actor: Actor, ipAddress?: string | null): Promise<void> {
    const [existing, fileResources, videoDrafts] = await Promise.all([
      this.findOrThrow(id),
      this.repository.findFileResourcesByCourseId(id),
      this.repository.findVideoDraftsByCourseId(id),
    ]);
    await this.assertCourseInScope(id, actor);

    await this.repository.delete(id);
    await deleteLessonResourceFiles(fileResources, { type: 'course', id });
    await deleteVideoDraftFiles(videoDrafts, { type: 'course', id });

    await auditLogService.record({
      action: 'COURSE_DELETED',
      actorId: actor.id,
      ipAddress,
      metadata: { courseId: existing.id, title: existing.title },
    });
  }

  async duplicate(
    id: string,
    dto: DuplicateCourseDto,
    actor: Actor,
    ipAddress?: string | null,
  ): Promise<Course> {
    await this.findOrThrow(id);
    await this.assertCourseInScope(id, actor);

    const includeResources = dto.includeResources ?? true;
    const source = await this.repository.findDuplicationSource(id);
    if (!source) throw new NotFoundError('Course not found.');

    const copiedPointers: string[] = [];
    const copiedFilePaths = new Map<string, string>();
    try {
      if (includeResources) {
        const resources = source.modules.flatMap((courseModule) =>
          courseModule.lessons.flatMap((lesson) => lesson.resources),
        );
        for (const resource of resources) {
          if (!resource.relativePath) continue;
          const copied = await storageProvider.copy(
            { relativePath: resource.relativePath },
            resource.originalFilename ?? resource.title,
            'lesson-resources',
          );
          copiedPointers.push(copied.relativePath);
          copiedFilePaths.set(resource.id, copied.relativePath);
        }
      }

      const created = await this.repository.duplicate(
        id,
        dto.title,
        actor.id,
        includeResources,
        copiedFilePaths,
      );

      await auditLogService.record({
        action: 'COURSE_CREATED',
        actorId: actor.id,
        ipAddress,
        metadata: { courseId: created.id, title: created.title, duplicatedFromId: id, includeResources },
      });

      return created;
    } catch (error) {
      await Promise.allSettled(copiedPointers.map((relativePath) => storageProvider.delete({ relativePath })));
      throw error;
    }
  }

  async listAssignments(courseId: string, actor: Actor) {
    await this.findOrThrow(courseId);
    await this.assertCourseInScope(courseId, actor);
    const assignments = await this.repository.listAssignments(courseId);
    return assignments.map((assignment) => ({
      id: assignment.group.id,
      name: assignment.group.name,
      code: assignment.group.code,
      memberCount: assignment.group._count.members,
    }));
  }

  async assignGroup(courseId: string, dto: AssignGroupDto, actor: Actor, ipAddress?: string | null) {
    const course = await this.findOrThrow(courseId);
    await this.assertCourseInScope(courseId, actor);
    const group = await this.groupsRepository.findById(dto.groupId);
    if (!group) throw new BadRequestError('Group not found.');
    if (actor.role === 'TRAINER' && group.trainerId !== actor.id) {
      throw new ForbiddenError("You don't have permission to assign this group.");
    }

    const existing = await this.repository.findAssignment(courseId, dto.groupId);
    if (existing) throw new ConflictError('This group is already assigned to the course.');

    const created = await this.repository.createAssignment(courseId, dto.groupId, actor.id);

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
          logger.error('Failed to send course-assigned notifications', {
            error,
            courseId,
            groupId: dto.groupId,
          });
        });
    }

    await auditLogService.record({
      action: 'COURSE_ASSIGNED_TO_GROUP',
      actorId: actor.id,
      ipAddress,
      metadata: { courseId, groupId: dto.groupId },
    });

    return created;
  }

  async unassignGroup(
    courseId: string,
    groupId: string,
    actor: Actor,
    ipAddress?: string | null,
  ): Promise<void> {
    await this.findOrThrow(courseId);
    await this.assertCourseInScope(courseId, actor);
    const group = await this.groupsRepository.findById(groupId);
    if (actor.role === 'TRAINER' && group?.trainerId !== actor.id) {
      throw new ForbiddenError("You don't have permission to unassign this group.");
    }
    const existing = await this.repository.findAssignment(courseId, groupId);
    if (!existing) throw new NotFoundError('This group is not assigned to the course.');

    await this.repository.deleteAssignment(courseId, groupId);

    await auditLogService.record({
      action: 'COURSE_UNASSIGNED_FROM_GROUP',
      actorId: actor.id,
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
        lessons: traineeView
          ? courseModule.lessons.filter((lesson) => lesson.isPublished)
          : courseModule.lessons,
      })),
      assignedGroups: groupAssignments.map((assignment) => assignment.group),
    };
  }

  private async findOrThrow(id: string) {
    const course = await this.repository.findById(id);
    if (!course) throw new NotFoundError('Course not found.');
    return course;
  }

  private async assertCourseInScope(id: string, actor: Actor): Promise<void> {
    if (actor.role === 'TRAINER' && !(await this.repository.isInTrainerScope(id, actor.id))) {
      throw new ForbiddenError("You don't have permission to manage this course.");
    }
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
