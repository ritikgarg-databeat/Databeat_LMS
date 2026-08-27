import type { Prisma, ResourceType, Role } from '@prisma/client';

import { ACCEPTED_LESSON_MIME_TYPES, MAX_LESSON_FILE_SIZE_BYTES } from '@/constants/file-types';
import { ProgressService } from '@/modules/progress/progress.service';
import { auditLogService } from '@/services/audit-log.service';
import { BaseService } from '@/services/base.service';
import { storageProvider } from '@/storage';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/utils/app-error';
import { toClientResource } from '@/utils/client-resource.util';
import { logger } from '@/utils/logger';
import { assertUploadMatchesDeclaredType, removeTemporaryUpload } from '@/utils/upload-safety.util';

import {
  cappedActiveSecondsDelta,
  isVideoProgressComplete,
  mergeWatchedIntervals,
  requiredResourceActiveSeconds,
  watchedDuration,
  type WatchedInterval,
} from './resource-progress.utils';
import type { CreateTextResourceDto, RecordResourceProgressDto, UploadResourceDto } from './resources.dto';
import { ResourcesRepository } from './resources.repository';
import { FILE_BACKED_RESOURCE_TYPES, TEXT_BACKED_RESOURCE_TYPES } from './resources.types';

interface Actor {
  id: string;
  role: Role;
}

// Business logic for the resources module. Controllers call into this layer only.
export class ResourcesService extends BaseService {
  constructor(
    protected readonly repository: ResourcesRepository = new ResourcesRepository(),
    private readonly progressService: ProgressService = new ProgressService(),
  ) {
    super();
  }

  async list(lessonId: string, actor: Actor) {
    await this.assertLessonReadable(lessonId, actor);
    const resources = await this.repository.findByLessonId(lessonId);
    return resources.map(toClientResource);
  }

  async uploadResource(
    lessonId: string,
    dto: UploadResourceDto,
    file: Express.Multer.File,
    actor: Actor,
    ipAddress?: string | null,
  ) {
    await this.assertLessonManageable(lessonId, actor);
    this.assertFileBackedType(dto.type);
    this.assertAcceptedMimeType(file.mimetype);
    this.assertFileSizeWithinLimit(file.size);

    let relativePath: string;
    try {
      await assertUploadMatchesDeclaredType(file);
      ({ relativePath } = await storageProvider.save({
        tempPath: file.path,
        buffer: file.buffer,
        originalName: file.originalname,
        entityType: 'lesson-resources',
      }));
    } catch (error) {
      await removeTemporaryUpload(file).catch(() => undefined);
      throw error;
    }

    let result: Awaited<ReturnType<ResourcesRepository['createAndInvalidateLearning']>>;
    try {
      const order = await this.repository.findNextOrder(lessonId);
      result = await this.repository.createAndInvalidateLearning(lessonId, {
        lesson: { connect: { id: lessonId } },
        type: dto.type,
        title: dto.title,
        relativePath,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        order,
        createdBy: { connect: { id: actor.id } },
      });
    } catch (error) {
      // The file is written before the database transaction. Roll it back if ordering, resource
      // creation, progress reopening, or quiz invalidation fails so storage cannot gain an orphan.
      await storageProvider.delete({ relativePath }).catch((cleanupError: unknown) => {
        logger.error('Failed to roll back lesson resource file after database failure', {
          cleanupError,
          lessonId,
          relativePath,
        });
      });
      throw error;
    }

    const { resource: created, contentVersion, reopenedLearnerCount, invalidatedQuizCount } = result;

    await auditLogService.record({
      action: 'RESOURCE_UPLOADED',
      actorId: actor.id,
      ipAddress,
      metadata: {
        lessonId,
        resourceId: created.id,
        type: created.type,
        originalFilename: created.originalFilename,
        contentVersion,
        reopenedLearnerCount,
        invalidatedQuizCount,
      },
    });

    return toClientResource(created);
  }

  async createTextResource(
    lessonId: string,
    dto: CreateTextResourceDto,
    actor: Actor,
    ipAddress?: string | null,
  ) {
    await this.assertLessonManageable(lessonId, actor);
    this.assertTextBackedType(dto.type);

    const order = await this.repository.findNextOrder(lessonId);

    const {
      resource: created,
      contentVersion,
      reopenedLearnerCount,
      invalidatedQuizCount,
    } = await this.repository.createAndInvalidateLearning(lessonId, {
      lesson: { connect: { id: lessonId } },
      type: dto.type,
      title: dto.title,
      content: dto.content,
      order,
      createdBy: { connect: { id: actor.id } },
    });

    await auditLogService.record({
      action: 'RESOURCE_UPLOADED',
      actorId: actor.id,
      ipAddress,
      metadata: {
        lessonId,
        resourceId: created.id,
        type: created.type,
        contentVersion,
        reopenedLearnerCount,
        invalidatedQuizCount,
      },
    });

    return toClientResource(created);
  }

  async remove(lessonId: string, resourceId: string, actor: Actor, ipAddress?: string | null): Promise<void> {
    await this.assertLessonManageable(lessonId, actor);
    const resource = await this.findResourceOrThrow(lessonId, resourceId);

    const { contentVersion, reopenedLearnerCount, invalidatedQuizCount } =
      await this.repository.deleteAndInvalidateLearning(lessonId, resourceId);

    if (resource.relativePath) {
      try {
        await storageProvider.delete({ relativePath: resource.relativePath });
      } catch (error) {
        // Best-effort: a file already missing on disk must not block the row from being deleted.
        logger.error('Failed to delete lesson resource file from storage', {
          error,
          resourceId,
          relativePath: resource.relativePath,
        });
      }
    }

    await auditLogService.record({
      action: 'RESOURCE_DELETED',
      actorId: actor.id,
      ipAddress,
      metadata: {
        lessonId,
        resourceId: resource.id,
        type: resource.type,
        title: resource.title,
        contentVersion,
        reopenedLearnerCount,
        invalidatedQuizCount,
      },
    });
  }

  async download(lessonId: string, resourceId: string, actor: Actor) {
    await this.assertLessonReadable(lessonId, actor);
    const resource = await this.findResourceOrThrow(lessonId, resourceId);

    if (!resource.relativePath) {
      throw new BadRequestError('This resource has no downloadable file.');
    }

    const stream = await storageProvider.getReadStream({ relativePath: resource.relativePath });
    return { stream, resource };
  }

  async recordProgress(lessonId: string, resourceId: string, dto: RecordResourceProgressDto, actor: Actor) {
    await this.assertLessonReadable(lessonId, actor);
    const resource = await this.findResourceOrThrow(lessonId, resourceId);
    const existing = await this.repository.findProgress(actor.id, resourceId);
    const now = new Date();
    const activeDelta = cappedActiveSecondsDelta(dto.activeSecondsDelta ?? 0, existing?.lastEventAt, now);
    const activeTimeSeconds = (existing?.activeTimeSeconds ?? 0) + activeDelta;
    const openedAt =
      existing?.openedAt ??
      (dto.event === 'OPEN' || dto.event === 'VIEW' || dto.event === 'VIDEO_HEARTBEAT' ? now : null);
    const acknowledgedAt = dto.event === 'ACKNOWLEDGE' ? now : (existing?.acknowledgedAt ?? null);
    const maxScrollPercentage = Math.max(existing?.maxScrollPercentage ?? 0, dto.scrollPercentage ?? 0);

    let furthestVideoSecond = existing?.furthestVideoSecond ?? 0;
    let videoDurationSeconds = existing?.videoDurationSeconds ?? null;
    let watchedIntervals = this.readIntervals(existing?.watchedIntervals);
    if (dto.event === 'VIDEO_HEARTBEAT') {
      if (resource.type !== 'VIDEO')
        throw new BadRequestError('Video progress is only valid for video resources.');
      const from = dto.watchedFromSeconds;
      const to = dto.watchedToSeconds;
      const duration = dto.durationSeconds;
      if (from === undefined || to === undefined || duration === undefined || to < from || to - from > 20) {
        throw new BadRequestError('A valid bounded video playback interval and duration are required.');
      }
      if (from > furthestVideoSecond + 2) {
        throw new BadRequestError('Video progress must be reported sequentially without skipping ahead.');
      }
      if ((dto.activeSecondsDelta ?? 0) > to - from + 1) {
        throw new BadRequestError('Active playback time cannot exceed the reported video interval.');
      }
      videoDurationSeconds = duration;
      watchedIntervals = mergeWatchedIntervals([
        ...watchedIntervals,
        [Math.max(0, from), Math.min(duration, to)],
      ]);
      furthestVideoSecond = Math.max(furthestVideoSecond, Math.min(duration, dto.positionSeconds ?? to));
    }

    const requiredSeconds = requiredResourceActiveSeconds(resource.type, resource.content);
    const watchedSeconds = watchedDuration(watchedIntervals);
    const videoComplete =
      resource.type === 'VIDEO' &&
      isVideoProgressComplete({
        durationSeconds: videoDurationSeconds,
        furthestSecond: furthestVideoSecond,
        activeTimeSeconds,
        intervals: watchedIntervals,
      });
    const needsScroll =
      resource.type === 'MARKDOWN' || resource.type === 'CODE_SNIPPET' || resource.type === 'IMAGE';
    const reviewComplete =
      resource.type !== 'VIDEO' &&
      openedAt !== null &&
      activeTimeSeconds >= requiredSeconds &&
      (!needsScroll || maxScrollPercentage >= 90) &&
      acknowledgedAt !== null;
    const completed = videoComplete || reviewComplete;

    const progress = await this.repository.upsertProgress(actor.id, resourceId, {
      userId: actor.id,
      resourceId,
      status: completed ? 'COMPLETED' : 'IN_PROGRESS',
      completedContentVersion: completed ? resource.contentVersion : existing?.completedContentVersion,
      activeTimeSeconds,
      furthestVideoSecond,
      videoDurationSeconds,
      watchedIntervals: watchedIntervals as unknown as Prisma.InputJsonValue,
      maxScrollPercentage,
      openedAt,
      acknowledgedAt,
      completedAt: completed ? (existing?.completedAt ?? now) : null,
      lastEventAt: now,
    });

    return {
      ...progress,
      requiredActiveSeconds: requiredSeconds,
      watchedPercentage:
        videoDurationSeconds && videoDurationSeconds > 0
          ? Math.min(100, Math.round((watchedSeconds / videoDurationSeconds) * 100))
          : 0,
    };
  }

  /**
   * Shared by `list` and `download` (Prompt 5 § SECURITY): Trainer/Super-Admin always allowed
   * (as long as the lesson exists); any other role must pass the self-contained lesson-
   * accessibility check. A non-staff caller always gets a 403, never a 404, so existence of an
   * inaccessible lesson is never leaked.
   */
  private async assertLessonReadable(lessonId: string, actor: Actor): Promise<void> {
    const accessible = await this.repository.isLessonAccessibleToUser(lessonId, actor.id, actor.role);
    if (!accessible) throw new ForbiddenError("You don't have permission to access this lesson's resources.");
    if (actor.role === 'TRAINEE') {
      await this.progressService.assertLessonAvailableForLearning(lessonId, actor);
    }
  }

  private async assertLessonManageable(lessonId: string, actor: Actor): Promise<void> {
    if (actor.role === 'TRAINER') {
      const manageable = await this.repository.isLessonManageableByTrainer(lessonId, actor.id);
      if (!manageable)
        throw new ForbiddenError("You don't have permission to change this lesson's resources.");
      return;
    }
    await this.assertLessonReadable(lessonId, actor);
  }

  private async findResourceOrThrow(lessonId: string, resourceId: string) {
    const resource = await this.repository.findById(resourceId);
    if (!resource || resource.lessonId !== lessonId) throw new NotFoundError('Resource not found.');
    return resource;
  }

  private assertFileBackedType(type: ResourceType): void {
    if (!(FILE_BACKED_RESOURCE_TYPES as readonly ResourceType[]).includes(type)) {
      throw new BadRequestError(
        `type must be one of ${FILE_BACKED_RESOURCE_TYPES.join(', ')} for file uploads — use POST /lessons/:id/resources/text for MARKDOWN, CODE_SNIPPET, or EXTERNAL_LINK.`,
      );
    }
  }

  private assertTextBackedType(type: ResourceType): void {
    if (!(TEXT_BACKED_RESOURCE_TYPES as readonly ResourceType[]).includes(type)) {
      throw new BadRequestError(
        `type must be one of ${TEXT_BACKED_RESOURCE_TYPES.join(', ')} — use POST /lessons/:id/resources/upload for file-backed resources.`,
      );
    }
  }

  private assertAcceptedMimeType(mimeType: string): void {
    if (!(ACCEPTED_LESSON_MIME_TYPES as readonly string[]).includes(mimeType)) {
      throw new BadRequestError(`Unsupported file type: ${mimeType}.`);
    }
  }

  private assertFileSizeWithinLimit(sizeBytes: number): void {
    if (sizeBytes > MAX_LESSON_FILE_SIZE_BYTES) {
      throw new BadRequestError(
        `File exceeds the maximum allowed size of ${MAX_LESSON_FILE_SIZE_BYTES} bytes.`,
      );
    }
  }

  private readIntervals(value: Prisma.JsonValue | null | undefined): WatchedInterval[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (entry): entry is WatchedInterval =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        typeof entry[0] === 'number' &&
        typeof entry[1] === 'number',
    );
  }
}
