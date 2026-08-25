import { createHash } from 'node:crypto';

import { Prisma, type LessonResource, type Role, type VideoGenerationJob } from '@prisma/client';

import { env } from '@/config/env';
import { MAX_LESSON_FILE_SIZE_BYTES } from '@/constants/file-types';
import { openAiVideoProvider } from '@/modules/ai/providers/openai-video.provider';
import { auditLogService } from '@/services/audit-log.service';
import { BaseService } from '@/services/base.service';
import { storageProvider } from '@/storage';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  TooManyRequestsError,
} from '@/utils/app-error';

import type {
  CreateVideoGenerationDto,
  RegenerateVideoDto,
  UpdateVideoStoryboardDto,
} from './video-generation.dto';
import { VideoGenerationRepository } from './video-generation.repository';
import {
  VIDEO_VOICES,
  videoStoryboardSchema,
  type AudioArtifact,
  type VideoStoryboardV1,
} from './video-generation.types';
import { traineeVideoUtcDayWindow } from './video-generation.utils';
import { buildVideoSourceSnapshot, listEligibleVideoSources } from './video-source-context';

interface Actor {
  id: string;
  role: Role;
}

type JobWithResource = VideoGenerationJob & { publishedResource?: LessonResource | null };

export class VideoGenerationService extends BaseService {
  constructor(private readonly repository: VideoGenerationRepository = new VideoGenerationRepository()) {
    super();
  }

  async sources(lessonId: string, actor: Actor) {
    if (!env.VIDEO_GENERATION_ENABLED) return { enabled: false, sources: [], warnings: [] };
    const lesson = await this.requireLesson(lessonId, actor);
    const eligible = listEligibleVideoSources(lesson);
    const snapshot = await buildVideoSourceSnapshot(lesson);
    return {
      enabled: true,
      lessonTitle: lesson.title,
      contentVersion: lesson.contentVersion,
      hasDescription: Boolean(lesson.description?.trim()),
      sources: eligible,
      warnings: snapshot.warnings,
      defaults: {
        targetDurationSeconds: 180,
        maxDurationSeconds: env.VIDEO_MAX_DURATION_SECONDS,
        language: 'English',
        voice: 'coral',
        style: 'VISUAL_EXPLAINER',
      },
    };
  }

  async list(lessonId: string, actor: Actor) {
    if (!env.VIDEO_GENERATION_ENABLED) return { enabled: false, jobs: [] };
    await this.requireLesson(lessonId, actor);
    return { enabled: true, jobs: (await this.repository.list(lessonId)).map((job) => this.toView(job)) };
  }

  async get(lessonId: string, jobId: string, actor: Actor) {
    this.requireEnabled();
    await this.requireLesson(lessonId, actor);
    return this.toView(await this.requireJob(lessonId, jobId));
  }

  async create(lessonId: string, dto: CreateVideoGenerationDto, actor: Actor, ipAddress?: string | null) {
    this.requireEnabled();
    if (!openAiVideoProvider.configured)
      throw new ServiceUnavailableError('AI video generation is not configured.');
    const lesson = await this.requireLesson(lessonId, actor);
    const active = await this.repository.findActiveForRequester(actor.id);
    if (active)
      throw new ConflictError('Finish or cancel your active video generation before starting another.');

    let snapshot;
    try {
      snapshot = await buildVideoSourceSnapshot(lesson, dto.selectedResourceIds);
    } catch (error) {
      throw new BadRequestError(error instanceof Error ? error.message : 'Invalid video source selection.');
    }
    const targetDurationSeconds = dto.targetDurationSeconds ?? 180;
    if (targetDurationSeconds < 60 || targetDurationSeconds > env.VIDEO_MAX_DURATION_SECONDS) {
      throw new BadRequestError(
        `Video duration must be between 60 and ${env.VIDEO_MAX_DURATION_SECONDS} seconds.`,
      );
    }
    const voice = dto.voice ?? 'coral';
    if (!(VIDEO_VOICES as readonly string[]).includes(voice)) throw new BadRequestError('Unsupported voice.');

    let job;
    try {
      job = await this.repository.create({
        lessonId,
        requesterId: actor.id,
        sourceContentVersion: snapshot.contentVersion,
        sourceFingerprint: snapshot.fingerprint,
        selectedResourceIds: snapshot.selectedResourceIds,
        creativeInstructions: dto.creativeInstructions?.trim() || undefined,
        targetDurationSeconds,
        language: dto.language?.trim() || 'English',
        voice,
        style: dto.style ?? 'CLEAN_CORPORATE',
        expiresAt: new Date(Date.now() + env.VIDEO_DRAFT_RETENTION_DAYS * 86_400_000),
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Finish or cancel your active video generation before starting another.');
      }
      throw error;
    }
    await auditLogService.record({
      action: 'VIDEO_GENERATION_CREATED',
      actorId: actor.id,
      ipAddress,
      metadata: { lessonId, jobId: job.id, sourceContentVersion: snapshot.contentVersion },
    });
    return this.toView(job);
  }

  async createTraineeExplanation(
    lessonId: string,
    creativeInstructions: string,
    aiMessageId: string,
    actor: Actor,
    ipAddress?: string | null,
  ) {
    this.requireEnabled();
    if (actor.role !== 'TRAINEE') throw new ForbiddenError('Only trainees can create private tutor videos.');
    if (!openAiVideoProvider.configured)
      throw new ServiceUnavailableError('AI video generation is not configured.');
    const lesson = await this.repository.findLessonForTrainee(lessonId, actor.id);
    if (!lesson) throw new ForbiddenError("You don't have permission to generate a video for this lesson.");
    const active = await this.repository.findActiveForRequester(actor.id, 'TRAINEE_EXPLANATION');
    if (active) throw new ConflictError('Your previous video is still being generated.');

    const now = new Date();
    const { start, end } = traineeVideoUtcDayWindow(now);
    const [dailyLimit, usedToday] = await Promise.all([
      this.repository.getTraineeVideoLimit(actor.id),
      this.repository.countTraineeVideosCreatedBetween(actor.id, start, end),
    ]);
    if (usedToday >= dailyLimit) {
      throw new TooManyRequestsError(
        dailyLimit === 0
          ? 'Trainee video generation is disabled by your trainer or administrator.'
          : `You have reached your daily limit of ${dailyLimit} video${dailyLimit === 1 ? '' : 's'}. It resets at 00:00 UTC.`,
      );
    }

    const snapshot = await buildVideoSourceSnapshot(lesson);
    let job;
    try {
      job = await this.repository.create({
        lessonId,
        requesterId: actor.id,
        purpose: 'TRAINEE_EXPLANATION',
        aiMessageId,
        sourceContentVersion: snapshot.contentVersion,
        sourceFingerprint: snapshot.fingerprint,
        selectedResourceIds: snapshot.selectedResourceIds,
        creativeInstructions: creativeInstructions.trim().slice(0, 2000) || undefined,
        targetDurationSeconds: 60,
        language: 'English',
        voice: 'coral',
        style: 'VISUAL_EXPLAINER',
        expiresAt: null,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Your previous video is still being generated.');
      }
      throw error;
    }
    await auditLogService.record({
      action: 'VIDEO_GENERATION_CREATED',
      actorId: actor.id,
      ipAddress,
      metadata: { lessonId, jobId: job.id, purpose: 'TRAINEE_EXPLANATION' },
    });
    return this.toTraineeView(job);
  }

  async getTraineeExplanation(jobId: string, actor: Actor) {
    if (actor.role !== 'TRAINEE') throw new ForbiddenError('Only trainees can access tutor videos.');
    const job = await this.repository.findOwnedTraineeJob(jobId, actor.id);
    if (!job) throw new NotFoundError('Video generation not found.');
    const lesson = await this.repository.findLessonForTrainee(job.lessonId, actor.id);
    if (!lesson) throw new ForbiddenError('You no longer have access to this lesson.');
    return this.toTraineeView(job);
  }

  async previewTraineeExplanation(jobId: string, actor: Actor) {
    await this.getTraineeExplanation(jobId, actor);
    const job = await this.repository.findOwnedTraineeJob(jobId, actor.id);
    if (!job?.artifactRelativePath || job.status !== 'READY')
      throw new NotFoundError('Video preview is not ready.');
    return {
      stream: await storageProvider.getReadStream({ relativePath: job.artifactRelativePath }),
      mimeType: job.artifactMimeType ?? 'video/mp4',
      size: job.artifactSizeBytes,
    };
  }

  async retryTraineeExplanation(jobId: string, actor: Actor) {
    if (actor.role !== 'TRAINEE') throw new ForbiddenError('Only trainees can retry tutor videos.');
    const job = await this.repository.findOwnedTraineeJob(jobId, actor.id);
    if (!job) throw new NotFoundError('Video generation not found.');
    if (job.status !== 'FAILED') throw new ConflictError('Only a failed video can be retried.');
    const lesson = await this.repository.findLessonForTrainee(job.lessonId, actor.id);
    if (!lesson) throw new ForbiddenError('You no longer have access to this lesson.');
    await this.assertCurrent(job, lesson);
    await this.deleteArtifacts(job, true);
    const hasStoryboard = Boolean(this.storyboard(job));
    const updated = await this.repository.update(job.id, {
      status: hasStoryboard ? 'QUEUED' : 'PLANNING',
      progressPercent: hasStoryboard ? 55 : 5,
      renderAttempts: 0,
      errorCode: null,
      errorMessage: null,
      completedAt: null,
      artifactRelativePath: null,
      captionRelativePath: null,
      thumbnailRelativePath: null,
      artifactMimeType: null,
      artifactSizeBytes: null,
      audioArtifacts: Prisma.JsonNull,
      leaseOwner: null,
      leaseExpiresAt: null,
    });
    return this.toTraineeView(updated);
  }

  async cleanupTraineeJobs(jobIds: string[], userId: string): Promise<void> {
    if (!jobIds.length) return;
    const jobs = await this.repository.findOwnedTraineeJobs(jobIds, userId);
    await this.repository.cancelOwnedTraineeJobs(jobIds, userId);
    await Promise.all(jobs.map((job) => this.deleteArtifacts(job, true)));
  }

  async updateStoryboard(lessonId: string, jobId: string, dto: UpdateVideoStoryboardDto, actor: Actor) {
    this.requireEnabled();
    const lesson = await this.requireLesson(lessonId, actor);
    const job = await this.requireJob(lessonId, jobId);
    if (!['STORYBOARD_READY', 'READY'].includes(job.status)) {
      throw new ConflictError('The storyboard cannot be edited in its current state.');
    }
    await this.assertCurrent(job, lesson);
    const snapshot = await buildVideoSourceSnapshot(lesson, this.jsonStringArray(job.selectedResourceIds));
    const storyboard = this.validateStoryboard(
      dto.storyboard,
      snapshot.sources.map((source) => source.id),
      snapshot.sources.filter((source) => !source.isVisualOnly).map((source) => source.id),
    );
    await this.deleteArtifacts(job, true);
    const updated = await this.repository.update(job.id, {
      storyboard: storyboard as never,
      status: 'STORYBOARD_READY',
      progressPercent: 50,
      artifactRelativePath: null,
      artifactMimeType: null,
      artifactSizeBytes: null,
      captionRelativePath: null,
      thumbnailRelativePath: null,
      audioArtifacts: Prisma.JsonNull,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
    });
    return this.toView(updated);
  }

  async regenerate(lessonId: string, jobId: string, dto: RegenerateVideoDto, actor: Actor) {
    this.requireEnabled();
    const lesson = await this.requireLesson(lessonId, actor);
    const job = await this.requireJob(lessonId, jobId);
    if (!['STORYBOARD_READY', 'READY', 'FAILED'].includes(job.status)) {
      throw new ConflictError('This video cannot be regenerated in its current state.');
    }
    await this.assertCurrent(job, lesson);
    const storyboard = this.storyboard(job);
    if (dto.sceneIds?.some((id) => !storyboard?.scenes.some((scene) => scene.id === id))) {
      throw new BadRequestError('One or more selected scenes do not exist.');
    }
    await this.deleteArtifacts(job, true);
    const updated = await this.repository.update(job.id, {
      status: 'PLANNING',
      progressPercent: 5,
      regenerationSceneIds: dto.sceneIds ?? [],
      errorCode: null,
      errorMessage: null,
      completedAt: null,
      artifactRelativePath: null,
      artifactMimeType: null,
      artifactSizeBytes: null,
      captionRelativePath: null,
      thumbnailRelativePath: null,
      audioArtifacts: Prisma.JsonNull,
      leaseOwner: null,
      leaseExpiresAt: null,
    });
    return this.toView(updated);
  }

  async render(lessonId: string, jobId: string, actor: Actor) {
    this.requireEnabled();
    const lesson = await this.requireLesson(lessonId, actor);
    const job = await this.requireJob(lessonId, jobId);
    if (!['STORYBOARD_READY', 'FAILED'].includes(job.status))
      throw new ConflictError('Approve the storyboard before rendering.');
    await this.assertCurrent(job, lesson);
    if (!this.storyboard(job)) throw new ConflictError('The storyboard is missing.');
    const updated = await this.repository.update(job.id, {
      status: 'QUEUED',
      progressPercent: 55,
      renderAttempts: 0,
      errorCode: null,
      errorMessage: null,
      leaseOwner: null,
      leaseExpiresAt: null,
    });
    return this.toView(updated);
  }

  async preview(lessonId: string, jobId: string, actor: Actor) {
    this.requireEnabled();
    await this.requireLesson(lessonId, actor);
    const job = await this.requireJob(lessonId, jobId);
    const relativePath =
      job.status === 'PUBLISHED' ? job.publishedResource?.relativePath : job.artifactRelativePath;
    if (!relativePath || !['READY', 'PUBLISHED'].includes(job.status))
      throw new NotFoundError('Video preview is not ready.');
    return {
      stream: await storageProvider.getReadStream({ relativePath }),
      mimeType: job.publishedResource?.mimeType ?? job.artifactMimeType ?? 'video/mp4',
      size: job.publishedResource?.fileSizeBytes ?? job.artifactSizeBytes,
    };
  }

  async publish(lessonId: string, jobId: string, actor: Actor, ipAddress?: string | null) {
    this.requireEnabled();
    const lesson = await this.requireLesson(lessonId, actor);
    const job = await this.requireJob(lessonId, jobId);
    if (job.status === 'PUBLISHED' && job.publishedResource) {
      return {
        resource: job.publishedResource,
        contentVersion: job.publishedContentVersion,
        reopenedLearnerCount: 0,
      };
    }
    if (job.status !== 'READY' || !job.artifactRelativePath || !job.artifactSizeBytes) {
      throw new ConflictError('The rendered video is not ready to publish.');
    }
    if (job.artifactSizeBytes > MAX_LESSON_FILE_SIZE_BYTES) {
      throw new BadRequestError('The rendered video exceeds the 200 MB lesson-resource limit.');
    }
    await this.assertCurrent(job, lesson);

    const copied = await storageProvider.copy(
      { relativePath: job.artifactRelativePath },
      `lesson-video-${job.id}.mp4`,
      'lesson-resources',
    );
    try {
      const result = await this.repository.publish(
        job.id,
        actor.id,
        copied.relativePath,
        job.artifactSizeBytes,
      );
      await auditLogService.record({
        action: 'VIDEO_GENERATION_PUBLISHED',
        actorId: actor.id,
        ipAddress,
        metadata: {
          lessonId,
          jobId,
          resourceId: result.resource.id,
          contentVersion: result.contentVersion,
          reopenedLearnerCount: result.reopenedLearnerCount,
        },
      });
      await this.deleteArtifacts(job, true);
      return result;
    } catch (error) {
      await storageProvider.delete(copied).catch(() => undefined);
      if (error instanceof ConflictError) {
        await this.repository
          .update(job.id, { status: 'STALE', errorCode: 'SOURCE_CHANGED' })
          .catch(() => undefined);
      }
      throw error;
    }
  }

  async cancel(lessonId: string, jobId: string, actor: Actor, ipAddress?: string | null) {
    this.requireEnabled();
    await this.requireLesson(lessonId, actor);
    const job = await this.requireJob(lessonId, jobId);
    if (job.status === 'PUBLISHED') throw new ConflictError('A published video cannot be cancelled.');
    if (job.status !== 'CANCELLED') {
      await this.repository.update(job.id, {
        status: 'CANCELLED',
        errorCode: null,
        errorMessage: null,
        completedAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        artifactRelativePath: null,
        captionRelativePath: null,
        thumbnailRelativePath: null,
        artifactMimeType: null,
        artifactSizeBytes: null,
        audioArtifacts: Prisma.JsonNull,
      });
      await this.deleteArtifacts(job, true);
      await auditLogService.record({
        action: 'VIDEO_GENERATION_CANCELLED',
        actorId: actor.id,
        ipAddress,
        metadata: { lessonId, jobId },
      });
    }
  }

  private requireEnabled(): void {
    if (!env.VIDEO_GENERATION_ENABLED) throw new ServiceUnavailableError('AI video generation is disabled.');
  }

  private async requireLesson(lessonId: string, actor: Actor) {
    const lesson = await this.repository.findLessonForActor(lessonId, actor);
    if (!lesson) throw new ForbiddenError("You don't have permission to generate video for this lesson.");
    return lesson;
  }

  private async requireJob(lessonId: string, jobId: string) {
    const job = await this.repository.findById(jobId);
    if (!job || job.lessonId !== lessonId) throw new NotFoundError('Video generation not found.');
    return job;
  }

  private async assertCurrent(
    job: VideoGenerationJob,
    lesson: NonNullable<Awaited<ReturnType<VideoGenerationRepository['findLessonForWorker']>>>,
  ) {
    const snapshot = await buildVideoSourceSnapshot(lesson, this.jsonStringArray(job.selectedResourceIds));
    if (
      lesson.contentVersion !== job.sourceContentVersion ||
      snapshot.fingerprint !== job.sourceFingerprint
    ) {
      await this.repository.update(job.id, {
        status: 'STALE',
        errorCode: 'SOURCE_CHANGED',
        errorMessage: 'Lesson content changed. Create a new video generation.',
      });
      throw new ConflictError('Lesson content changed; create a new video generation.');
    }
  }

  private validateStoryboard(
    input: unknown,
    validSourceIds: string[],
    factualSourceIds: string[],
  ): VideoStoryboardV1 {
    const parsed = videoStoryboardSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestError('The storyboard is invalid.', parsed.error.issues);
    const ids = new Set<string>();
    const sourceIds = new Set(validSourceIds);
    const factualIds = new Set(factualSourceIds);
    for (const scene of parsed.data.scenes) {
      if (ids.has(scene.id)) throw new BadRequestError('Scene IDs must be unique.');
      ids.add(scene.id);
      if (scene.sourceRefs.some((ref) => !sourceIds.has(ref))) {
        throw new BadRequestError(`Scene "${scene.heading}" references unknown lesson evidence.`);
      }
      if (!scene.sourceRefs.some((ref) => factualIds.has(ref))) {
        throw new BadRequestError(`Scene "${scene.heading}" is not grounded in factual lesson evidence.`);
      }
    }
    const duration = parsed.data.scenes.reduce((total, scene) => total + scene.durationSeconds, 0);
    if (duration !== parsed.data.totalDurationSeconds) {
      throw new BadRequestError('Storyboard total duration must equal the sum of all scene durations.');
    }
    if (duration < 60 || duration > env.VIDEO_MAX_DURATION_SECONDS) {
      throw new BadRequestError(
        `Storyboard duration must be between 60 and ${env.VIDEO_MAX_DURATION_SECONDS} seconds.`,
      );
    }
    return parsed.data;
  }

  private storyboard(job: Pick<VideoGenerationJob, 'storyboard'>): VideoStoryboardV1 | null {
    const parsed = videoStoryboardSchema.safeParse(job.storyboard);
    return parsed.success ? parsed.data : null;
  }

  private jsonStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
  }

  toView(job: JobWithResource) {
    return {
      id: job.id,
      lessonId: job.lessonId,
      purpose: job.purpose,
      status: job.status,
      sourceContentVersion: job.sourceContentVersion,
      settings: {
        selectedResourceIds: this.jsonStringArray(job.selectedResourceIds),
        creativeInstructions: job.creativeInstructions,
        targetDurationSeconds: job.targetDurationSeconds,
        language: job.language,
        voice: job.voice,
        style: job.style,
      },
      storyboard: this.storyboard(job),
      progress: job.progressPercent,
      error: job.errorCode ? { code: job.errorCode, message: job.errorMessage } : null,
      tokenUsage: { input: job.inputTokens, output: job.outputTokens },
      renderAttempts: job.renderAttempts,
      hasPreview:
        job.status === 'PUBLISHED'
          ? Boolean(job.publishedResourceId)
          : job.status === 'READY' && Boolean(job.artifactRelativePath),
      publishedResourceId: job.publishedResourceId,
      publishedContentVersion: job.publishedContentVersion,
      expiresAt: job.expiresAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  toTraineeView(job: JobWithResource) {
    return {
      id: job.id,
      lessonId: job.lessonId,
      purpose: job.purpose,
      status: job.status,
      progress: job.progressPercent,
      error: job.errorCode ? { code: job.errorCode, message: job.errorMessage } : null,
      hasPreview: job.status === 'READY' && Boolean(job.artifactRelativePath),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  private async deleteArtifacts(job: VideoGenerationJob, includeAudio: boolean): Promise<void> {
    const audio = Array.isArray(job.audioArtifacts) ? (job.audioArtifacts as unknown as AudioArtifact[]) : [];
    const paths = [job.artifactRelativePath, job.captionRelativePath, job.thumbnailRelativePath];
    if (includeAudio) paths.push(...audio.map((item) => item.relativePath));
    await Promise.allSettled(
      paths
        .filter((relativePath): relativePath is string => Boolean(relativePath))
        .map((relativePath) => storageProvider.delete({ relativePath })),
    );
  }
}

export function hashAudioInput(narration: string, voice: string, language: string): string {
  return createHash('sha256').update(`v2\n${voice}\n${language}\n${narration}`).digest('hex');
}

export const videoGenerationService = new VideoGenerationService();
