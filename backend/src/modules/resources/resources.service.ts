import type { ResourceType, Role } from '@prisma/client';

import { ACCEPTED_LESSON_MIME_TYPES, MAX_LESSON_FILE_SIZE_BYTES } from '@/constants/file-types';
import { auditLogService } from '@/services/audit-log.service';
import { BaseService } from '@/services/base.service';
import { storageProvider } from '@/storage';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/utils/app-error';
import { logger } from '@/utils/logger';
import { assertUploadMatchesDeclaredType, removeTemporaryUpload } from '@/utils/upload-safety.util';

import type { CreateTextResourceDto, UploadResourceDto } from './resources.dto';
import { ResourcesRepository } from './resources.repository';
import { FILE_BACKED_RESOURCE_TYPES, TEXT_BACKED_RESOURCE_TYPES } from './resources.types';

interface Actor {
  id: string;
  role: Role;
}

// Business logic for the resources module. Controllers call into this layer only.
export class ResourcesService extends BaseService {
  constructor(protected readonly repository: ResourcesRepository = new ResourcesRepository()) {
    super();
  }

  async list(lessonId: string, actor: Actor) {
    await this.assertLessonReadable(lessonId, actor);
    return this.repository.findByLessonId(lessonId);
  }

  async uploadResource(
    lessonId: string,
    dto: UploadResourceDto,
    file: Express.Multer.File,
    actor: Actor,
    ipAddress?: string | null,
  ) {
    await this.assertLessonReadable(lessonId, actor);
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

    return created;
  }

  async createTextResource(
    lessonId: string,
    dto: CreateTextResourceDto,
    actor: Actor,
    ipAddress?: string | null,
  ) {
    await this.assertLessonReadable(lessonId, actor);
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

    return created;
  }

  async remove(
    lessonId: string,
    resourceId: string,
    actor: Actor,
    ipAddress?: string | null,
  ): Promise<void> {
    await this.assertLessonReadable(lessonId, actor);
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

  /**
   * Shared by `list` and `download` (Prompt 5 § SECURITY): Trainer/Super-Admin always allowed
   * (as long as the lesson exists); any other role must pass the self-contained lesson-
   * accessibility check. A non-staff caller always gets a 403, never a 404, so existence of an
   * inaccessible lesson is never leaked.
   */
  private async assertLessonReadable(lessonId: string, actor: Actor): Promise<void> {
    const accessible = await this.repository.isLessonAccessibleToUser(lessonId, actor.id, actor.role);
    if (!accessible) throw new ForbiddenError("You don't have permission to access this lesson's resources.");
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
}
