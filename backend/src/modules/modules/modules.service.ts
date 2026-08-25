import type { Role } from '@prisma/client';

import { auditLogService } from '@/services/audit-log.service';
import { BaseService } from '@/services/base.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/utils/app-error';
import { deleteLessonResourceFiles } from '@/utils/lesson-resource-cleanup.util';
import { deleteVideoDraftFiles } from '@/utils/video-draft-cleanup.util';

import type {
  CreateModuleDto,
  ReorderModulesDto,
  UpdateModuleDto,
  UpdateModuleStatusDto,
} from './modules.dto';
import { ModulesRepository } from './modules.repository';

interface Actor {
  id: string;
  role: Role;
}

// Business logic for the modules module. Controllers call into this layer only.
export class ModulesService extends BaseService {
  constructor(protected readonly repository: ModulesRepository = new ModulesRepository()) {
    super();
  }

  async list(courseId: string, actor: Actor) {
    await this.assertCourseInScope(courseId, actor);
    return this.repository.findByCourseId(courseId);
  }

  async getById(id: string, actor: Actor) {
    const module = await this.repository.findByIdWithLessons(id);
    if (!module) throw new NotFoundError('Module not found.');
    await this.assertCourseInScope(module.courseId, actor);
    return module;
  }

  async create(dto: CreateModuleDto, actor: Actor, ipAddress?: string | null) {
    await this.assertCourseExists(dto.courseId);
    await this.assertCourseInScope(dto.courseId, actor);
    const order = await this.repository.findNextOrder(dto.courseId);

    const created = await this.repository.create({
      course: { connect: { id: dto.courseId } },
      title: dto.title,
      description: dto.description,
      estimatedDurationMinutes: dto.estimatedDurationMinutes,
      order,
    });

    await auditLogService.record({
      action: 'MODULE_CREATED',
      actorId: actor.id,
      ipAddress,
      metadata: { moduleId: created.id, courseId: created.courseId, title: created.title },
    });

    return created;
  }

  async update(id: string, dto: UpdateModuleDto, actor: Actor, ipAddress?: string | null) {
    const existing = await this.findOrThrow(id);
    await this.assertCourseInScope(existing.courseId, actor);

    const updated = await this.repository.update(id, {
      title: dto.title,
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.estimatedDurationMinutes !== undefined
        ? { estimatedDurationMinutes: dto.estimatedDurationMinutes }
        : {}),
    });

    await auditLogService.record({
      action: 'MODULE_UPDATED',
      actorId: actor.id,
      ipAddress,
      metadata: { moduleId: existing.id, changes: { ...dto } },
    });

    return updated;
  }

  async updateStatus(id: string, dto: UpdateModuleStatusDto, actor: Actor, ipAddress?: string | null) {
    const existing = await this.findOrThrow(id);
    await this.assertCourseInScope(existing.courseId, actor);

    const updated = await this.repository.update(id, { isPublished: dto.isPublished });

    await auditLogService.record({
      action: 'MODULE_UPDATED',
      actorId: actor.id,
      ipAddress,
      metadata: { moduleId: existing.id, isPublishedChangedTo: dto.isPublished },
    });

    return updated;
  }

  async remove(id: string, actor: Actor, ipAddress?: string | null): Promise<void> {
    const [existing, fileResources, videoDrafts] = await Promise.all([
      this.findOrThrow(id),
      this.repository.findFileResourcesByModuleId(id),
      this.repository.findVideoDraftsByModuleId(id),
    ]);
    await this.assertCourseInScope(existing.courseId, actor);

    await this.repository.delete(id);
    await deleteLessonResourceFiles(fileResources, { type: 'module', id });
    await deleteVideoDraftFiles(videoDrafts, { type: 'module', id });

    await auditLogService.record({
      action: 'MODULE_DELETED',
      actorId: actor.id,
      ipAddress,
      metadata: { moduleId: existing.id, courseId: existing.courseId, title: existing.title },
    });
  }

  async reorder(dto: ReorderModulesDto, actor: Actor, ipAddress?: string | null): Promise<void> {
    await this.assertCourseInScope(dto.courseId, actor);
    const [belonging, totalCount] = await Promise.all([
      this.repository.findManyByIds(dto.courseId, dto.orderedIds),
      this.repository.countByCourseId(dto.courseId),
    ]);
    if (belonging.length !== dto.orderedIds.length) {
      throw new BadRequestError('orderedIds must only contain modules that belong to this course.');
    }
    // A partial submission would leave the untouched siblings' `order` values as-is, colliding
    // with the freshly-assigned 0..N-1 range and corrupting the course's module ordering.
    if (dto.orderedIds.length !== totalCount) {
      throw new BadRequestError('orderedIds must include every module in this course.');
    }

    await this.repository.reorder(dto.orderedIds.map((id, index) => ({ id, order: index })));

    await auditLogService.record({
      action: 'MODULE_REORDERED',
      actorId: actor.id,
      ipAddress,
      metadata: { courseId: dto.courseId, orderedIds: dto.orderedIds },
    });
  }

  private async findOrThrow(id: string) {
    const module = await this.repository.findById(id);
    if (!module) throw new NotFoundError('Module not found.');
    return module;
  }

  private async assertCourseExists(courseId: string): Promise<void> {
    const course = await this.repository.findCourseById(courseId);
    if (!course) throw new BadRequestError('Course not found.');
  }

  private async assertCourseInScope(courseId: string, actor: Actor): Promise<void> {
    if (actor.role === 'TRAINER' && !(await this.repository.isCourseInTrainerScope(courseId, actor.id))) {
      throw new ForbiddenError("You don't have permission to manage this course.");
    }
  }
}
