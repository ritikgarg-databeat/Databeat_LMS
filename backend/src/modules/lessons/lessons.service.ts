import type { Role } from '@prisma/client';

import { ProgressService } from '@/modules/progress/progress.service';
import { auditLogService } from '@/services/audit-log.service';
import { BaseService } from '@/services/base.service';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/utils/app-error';
import { toClientResource } from '@/utils/client-resource.util';
import { hasNewLessonContent } from '@/utils/lesson-content-status.util';
import { deleteLessonResourceFiles } from '@/utils/lesson-resource-cleanup.util';
import { deleteVideoDraftFiles } from '@/utils/video-draft-cleanup.util';

import type {
  CreateLessonDto,
  ReorderLessonsDto,
  UpdateLessonDto,
  UpdateLessonStatusDto,
} from './lessons.dto';
import { LessonsRepository } from './lessons.repository';

interface Actor {
  id: string;
  role: Role;
}

// Business logic for the lessons module. Controllers call into this layer only.
export class LessonsService extends BaseService {
  constructor(
    protected readonly repository: LessonsRepository = new LessonsRepository(),
    private readonly progressService: ProgressService = new ProgressService(),
  ) {
    super();
  }

  async list(moduleId: string, actor: Actor) {
    await this.assertModuleReadable(moduleId, actor);
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
      await this.progressService.assertLessonAvailableForLearning(id, actor);
    }
    if (actor.role === 'TRAINER' && !(await this.repository.isLessonReadableByTrainer(id, actor.id))) {
      throw new ForbiddenError("You don't have permission to view this lesson.");
    }

    const lesson = await this.repository.findDetailedById(id, actor.id);
    if (!lesson) throw new NotFoundError('Lesson not found.');

    const { progress, resources, ...rest } = lesson;
    if (actor.role === 'TRAINEE') {
      rest.module.course.isMandatory = await this.repository.isCourseMandatoryForUser(
        rest.module.course.id,
        actor.id,
      );
    }
    const learnerProgress = progress[0];
    const latestResourceCreatedAt = resources.reduce<Date | null>(
      (latest, resource) => (!latest || resource.createdAt > latest ? resource.createdAt : latest),
      null,
    );

    return {
      ...rest,
      resources: resources.map((resource) => {
        const { progress: resourceProgress, ...resourceRest } = resource;
        return { ...toClientResource(resourceRest), progress: resourceProgress[0] ?? null };
      }),
      progress: learnerProgress
        ? {
            ...learnerProgress,
            hasNewContent:
              (learnerProgress.completedContentVersion !== null &&
                learnerProgress.completedContentVersion < rest.contentVersion) ||
              hasNewLessonContent(latestResourceCreatedAt, learnerProgress.lastViewedAt),
          }
        : null,
    };
  }

  async create(dto: CreateLessonDto, actor: Actor, ipAddress?: string | null) {
    await this.assertModuleExists(dto.moduleId);
    await this.assertModuleInScope(dto.moduleId, actor);
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
      actorId: actor.id,
      ipAddress,
      metadata: { lessonId: created.id, moduleId: created.moduleId, title: created.title },
    });

    return created;
  }

  async update(id: string, dto: UpdateLessonDto, actor: Actor, ipAddress?: string | null) {
    const existing = await this.findOrThrow(id);
    await this.assertLessonInScope(id, actor);

    const updateData = {
      title: dto.title,
      type: dto.type,
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.estimatedDurationMinutes !== undefined
        ? { estimatedDurationMinutes: dto.estimatedDurationMinutes }
        : {}),
    };
    const contentChanged =
      (dto.title !== undefined && dto.title !== existing.title) ||
      (dto.type !== undefined && dto.type !== existing.type) ||
      (dto.description !== undefined && dto.description !== existing.description);

    const result = contentChanged
      ? await this.repository.updateAndInvalidateLearning(id, updateData)
      : {
          lesson: await this.repository.update(id, updateData),
          reopenedLearnerCount: 0,
          invalidatedQuizCount: 0,
        };
    const updated = result.lesson;

    await auditLogService.record({
      action: 'LESSON_UPDATED',
      actorId: actor.id,
      ipAddress,
      metadata: {
        lessonId: existing.id,
        changes: { ...dto },
        contentVersion: updated.contentVersion,
        reopenedLearnerCount: result.reopenedLearnerCount,
        invalidatedQuizCount: result.invalidatedQuizCount,
      },
    });

    return updated;
  }

  async updateStatus(id: string, dto: UpdateLessonStatusDto, actor: Actor, ipAddress?: string | null) {
    const existing = await this.findOrThrow(id);
    await this.assertLessonInScope(id, actor);

    const updated = await this.repository.update(id, { isPublished: dto.isPublished });

    await auditLogService.record({
      action: 'LESSON_UPDATED',
      actorId: actor.id,
      ipAddress,
      metadata: { lessonId: existing.id, isPublishedChangedTo: dto.isPublished },
    });

    return updated;
  }

  async remove(id: string, actor: Actor, ipAddress?: string | null): Promise<void> {
    const [existing, fileResources, videoDrafts] = await Promise.all([
      this.findOrThrow(id),
      this.repository.findFileResourcesByLessonId(id),
      this.repository.findVideoDraftsByLessonId(id),
    ]);
    await this.assertLessonInScope(id, actor);

    await this.repository.delete(id);

    await deleteLessonResourceFiles(fileResources, { type: 'lesson', id });
    await deleteVideoDraftFiles(videoDrafts, { type: 'lesson', id });

    await auditLogService.record({
      action: 'LESSON_DELETED',
      actorId: actor.id,
      ipAddress,
      metadata: { lessonId: existing.id, moduleId: existing.moduleId, title: existing.title },
    });
  }

  async reorder(dto: ReorderLessonsDto, actor: Actor, ipAddress?: string | null): Promise<void> {
    await this.assertModuleInScope(dto.moduleId, actor);
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
      actorId: actor.id,
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

  private async assertModuleInScope(moduleId: string, actor: Actor): Promise<void> {
    if (actor.role === 'TRAINER' && !(await this.repository.isModuleInTrainerScope(moduleId, actor.id))) {
      throw new ForbiddenError("You don't have permission to manage this course module.");
    }
  }

  private async assertModuleReadable(moduleId: string, actor: Actor): Promise<void> {
    if (actor.role === 'TRAINER' && !(await this.repository.isModuleReadableByTrainer(moduleId, actor.id))) {
      throw new ForbiddenError("You don't have permission to view this course module.");
    }
  }

  private async assertLessonInScope(lessonId: string, actor: Actor): Promise<void> {
    if (actor.role === 'TRAINER' && !(await this.repository.isLessonInTrainerScope(lessonId, actor.id))) {
      throw new ForbiddenError("You don't have permission to manage this lesson.");
    }
  }
}
