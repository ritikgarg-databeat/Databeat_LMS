import {
  Prisma,
  type Role,
  type VideoGenerationJob,
  type VideoGenerationStatus,
  type VideoStylePreset,
} from '@prisma/client';

import { trainerCourseScope } from '@/policies/trainer-scope.policy';
import { BaseRepository } from '@/repositories/base.repository';
import { ConflictError } from '@/utils/app-error';

import { ACTIVE_VIDEO_JOB_STATUSES } from './video-generation.types';

interface Actor {
  id: string;
  role: Role;
}

interface CreateJobInput {
  lessonId: string;
  requesterId: string;
  sourceContentVersion: number;
  sourceFingerprint: string;
  selectedResourceIds: string[];
  creativeInstructions?: string;
  targetDurationSeconds: number;
  language: string;
  voice: string;
  style: VideoStylePreset;
  expiresAt: Date;
}

export class VideoGenerationRepository extends BaseRepository {
  findLessonForActor(lessonId: string, actor: Actor) {
    return this.db.lesson.findFirst({
      where: {
        id: lessonId,
        module: {
          course: {
            deletedAt: null,
            ...(actor.role === 'TRAINER' ? trainerCourseScope(actor.id) : {}),
          },
        },
      },
      include: { resources: { orderBy: { order: 'asc' } } },
    });
  }

  findLessonForWorker(lessonId: string) {
    return this.db.lesson.findUnique({
      where: { id: lessonId },
      include: { resources: { orderBy: { order: 'asc' } } },
    });
  }

  list(lessonId: string) {
    return this.db.videoGenerationJob.findMany({
      where: { lessonId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { publishedResource: true },
    });
  }

  findById(jobId: string) {
    return this.db.videoGenerationJob.findUnique({
      where: { id: jobId },
      include: { publishedResource: true },
    });
  }

  findActiveForRequester(requesterId: string) {
    return this.db.videoGenerationJob.findFirst({
      where: { requestedById: requesterId, status: { in: [...ACTIVE_VIDEO_JOB_STATUSES] } },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(input: CreateJobInput) {
    return this.db.videoGenerationJob.create({
      data: {
        lessonId: input.lessonId,
        requestedById: input.requesterId,
        sourceContentVersion: input.sourceContentVersion,
        sourceFingerprint: input.sourceFingerprint,
        selectedResourceIds: input.selectedResourceIds,
        creativeInstructions: input.creativeInstructions,
        targetDurationSeconds: input.targetDurationSeconds,
        language: input.language,
        voice: input.voice,
        style: input.style,
        expiresAt: input.expiresAt,
      },
      include: { publishedResource: true },
    });
  }

  update(jobId: string, data: Prisma.VideoGenerationJobUpdateInput) {
    return this.db.videoGenerationJob.update({ where: { id: jobId }, data });
  }

  async claimNext(
    workerId: string,
    leaseMilliseconds: number,
    statuses: VideoGenerationStatus[] = ['PLANNING', 'QUEUED'],
  ): Promise<VideoGenerationJob | null> {
    const now = new Date();
    const candidate = await this.db.videoGenerationJob.findFirst({
      where: {
        status: { in: statuses },
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!candidate) return null;

    const claimed = await this.db.videoGenerationJob.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
      },
      data: {
        leaseOwner: workerId,
        leaseExpiresAt: new Date(now.getTime() + leaseMilliseconds),
        startedAt: candidate.startedAt ?? now,
      },
    });
    return claimed.count === 1
      ? this.db.videoGenerationJob.findUnique({ where: { id: candidate.id } })
      : null;
  }

  releaseLease(jobId: string) {
    return this.db.videoGenerationJob.updateMany({
      where: { id: jobId },
      data: { leaseOwner: null, leaseExpiresAt: null },
    });
  }

  findExpiredDrafts(now: Date) {
    return this.db.videoGenerationJob.findMany({
      where: {
        expiresAt: { lt: now },
        status: { in: ['STORYBOARD_READY', 'READY', 'FAILED', 'CANCELLED', 'STALE'] },
      },
      take: 100,
    });
  }

  async publish(jobId: string, actorId: string, copiedRelativePath: string, fileSizeBytes: number) {
    return this.db.$transaction(async (tx) => {
      const job = await tx.videoGenerationJob.findUnique({ where: { id: jobId } });
      if (!job || job.status !== 'READY' || job.publishedResourceId) {
        throw new ConflictError('This video is not ready to publish.');
      }

      const versionUpdate = await tx.lesson.updateMany({
        where: { id: job.lessonId, contentVersion: job.sourceContentVersion },
        data: { contentVersion: { increment: 1 } },
      });
      if (versionUpdate.count !== 1) throw new ConflictError('Lesson content changed; regenerate the video.');

      const orderRow = await tx.lessonResource.findFirst({
        where: { lessonId: job.lessonId },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      const resource = await tx.lessonResource.create({
        data: {
          lessonId: job.lessonId,
          type: 'VIDEO',
          title: 'AI lesson video',
          relativePath: copiedRelativePath,
          originalFilename: `lesson-video-${job.id}.mp4`,
          mimeType: 'video/mp4',
          fileSizeBytes,
          order: (orderRow?.order ?? -1) + 1,
          createdById: actorId,
        },
      });
      const reopened = await tx.lessonProgress.updateMany({
        where: { lessonId: job.lessonId, status: 'COMPLETED' },
        data: { status: 'IN_PROGRESS', completedAt: null },
      });
      const invalidatedQuizCount = await tx.lessonQuizAttempt.count({ where: { lessonId: job.lessonId } });
      const contentVersion = job.sourceContentVersion + 1;
      await tx.videoGenerationJob.update({
        where: { id: job.id },
        data: {
          status: 'PUBLISHED',
          progressPercent: 100,
          publishedResourceId: resource.id,
          publishedContentVersion: contentVersion,
          artifactRelativePath: null,
          captionRelativePath: null,
          thumbnailRelativePath: null,
          audioArtifacts: Prisma.JsonNull,
          completedAt: new Date(),
          leaseOwner: null,
          leaseExpiresAt: null,
        },
      });
      return {
        resource,
        contentVersion,
        reopenedLearnerCount: reopened.count,
        invalidatedQuizCount,
      };
    });
  }

  countQueued(): Promise<number> {
    return this.db.videoGenerationJob.count({ where: { status: { in: ['PLANNING', 'QUEUED'] } } });
  }

  updateIfStatus(
    jobId: string,
    status: VideoGenerationStatus,
    data: Prisma.VideoGenerationJobUpdateManyMutationInput,
  ) {
    return this.db.videoGenerationJob.updateMany({ where: { id: jobId, status }, data });
  }
}
