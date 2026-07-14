import type { Role } from '@prisma/client';

import { auditLogService } from '@/services/audit-log.service';
import { BaseService } from '@/services/base.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/utils/app-error';

import type { CreateLessonDto, ReorderLessonsDto, UpdateLessonDto, UpdateLessonStatusDto } from './lessons.dto';
import { LessonsRepository } from './lessons.repository';

interface Actor {
  id: string;
  role: Role;
}

// Business logic for the lessons module. Controllers call into this layer only.
export class LessonsService extends BaseService {
  constructor(protected readonly repository: LessonsRepository = new LessonsRepository()) {
    super();
  }

  list(moduleId: string) {
    return this.repository.findByModuleId(moduleId);
  }

  /**
   * Flat lookup used by both the trainer editor and the trainee viewer (Prompt 5). A Trainee
   * gets a 403 for anything inaccessible (draft/unpublished/unassigned) rather than a 404, so
   * existence of the lesson is never leaked beyond what the accessibility check already implies.
   */
  async getById(id: string, actor: Actor) {
    if (actor.role === 'TRAINEE') {
      const accessible = await this.repository.isAccessibleToUser(id, actor.id, actor.role);
      if (!accessible) throw new ForbiddenError("You don't have permission to view this lesson.");
    }

    const lesson = await this.repository.findDetailedById(id, actor.id);
    if (!lesson) throw new NotFoundError('Lesson not found.');

    const { progress, ...rest } = lesson;
    return { ...rest, progress: progress[0] ?? null };
  }

  async create(dto: CreateLessonDto, actorId: string, ipAddress?: string | null) {
    await this.assertModuleExists(dto.moduleId);
    const order = await this.repository.findNextOrder(dto.moduleId);

    const created = await this.repository.create({
      module: { connect: { id: dto.moduleId } },
      title: dto.title,
      description: dto.description,
      type: dto.type,
      estimatedDurationMinutes: dto.estimatedDurationMinutes,
      order,
    });

    await auditLogService.record({
      action: 'LESSON_CREATED',
      actorId,
      ipAddress,
      metadata: { lessonId: created.id, moduleId: created.moduleId, title: created.title },
    });

    return created;
  }

  async update(id: string, dto: UpdateLessonDto, actorId: string, ipAddress?: string | null) {
    const existing = await this.findOrThrow(id);

    const updated = await this.repository.update(id, {
      title: dto.title,
      type: dto.type,
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.estimatedDurationMinutes !== undefined
        ? { estimatedDurationMinutes: dto.estimatedDurationMinutes }
        : {}),
    });

    await auditLogService.record({
      action: 'LESSON_UPDATED',
      actorId,
      ipAddress,
      metadata: { lessonId: existing.id, changes: { ...dto } },
    });

    return updated;
  }

  async updateStatus(id: string, dto: UpdateLessonStatusDto, actorId: string, ipAddress?: string | null) {
    const existing = await this.findOrThrow(id);

    const updated = await this.repository.update(id, { isPublished: dto.isPublished });

    await auditLogService.record({
      action: 'LESSON_UPDATED',
      actorId,
      ipAddress,
      metadata: { lessonId: existing.id, isPublishedChangedTo: dto.isPublished },
    });

    return updated;
  }

  async remove(id: string, actorId: string, ipAddress?: string | null): Promise<void> {
    const existing = await this.findOrThrow(id);

    await this.repository.delete(id);

    await auditLogService.record({
      action: 'LESSON_DELETED',
      actorId,
      ipAddress,
      metadata: { lessonId: existing.id, moduleId: existing.moduleId, title: existing.title },
    });
  }

  async reorder(dto: ReorderLessonsDto, actorId: string, ipAddress?: string | null): Promise<void> {
    const [belonging, totalCount] = await Promise.all([
      this.repository.findManyByIds(dto.moduleId, dto.orderedIds),
      this.repository.countByModuleId(dto.moduleId),
    ]);
    if (belonging.length !== dto.orderedIds.length) {
      throw new BadRequestError('orderedIds must only contain lessons that belong to this module.');
    }
    // A partial submission would leave the untouched siblings' `order` values as-is, colliding
    // with the freshly-assigned 0..N-1 range and corrupting the module's lesson ordering.
    if (dto.orderedIds.length !== totalCount) {
      throw new BadRequestError('orderedIds must include every lesson in this module.');
    }

    await this.repository.reorder(dto.orderedIds.map((id, index) => ({ id, order: index })));

    await auditLogService.record({
      action: 'LESSON_REORDERED',
      actorId,
      ipAddress,
      metadata: { moduleId: dto.moduleId, orderedIds: dto.orderedIds },
    });
  }

  private async findOrThrow(id: string) {
    const lesson = await this.repository.findById(id);
    if (!lesson) throw new NotFoundError('Lesson not found.');
    return lesson;
  }

  private async assertModuleExists(moduleId: string): Promise<void> {
    const module = await this.repository.findModuleById(moduleId);
    if (!module) throw new BadRequestError('Module not found.');
  }
}
