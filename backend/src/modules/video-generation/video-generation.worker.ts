import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { Prisma, type VideoGenerationJob } from '@prisma/client';

import { env } from '@/config/env';
import { openAiVideoProvider } from '@/modules/ai/providers/openai-video.provider';
import { storageProvider } from '@/storage';
import { logger } from '@/utils/logger';

import { measureMp3DurationSeconds } from './audio-duration.util';
import { VideoGenerationRepository } from './video-generation.repository';
import { hashAudioInput } from './video-generation.service';
import { videoStoryboardSchema, type AudioArtifact, type VideoStoryboardV1 } from './video-generation.types';
import { synchronizeStoryboardToAudio, validateStoryboardForSources } from './video-generation.utils';
import { videoRendererService } from './video-renderer.service';
import { buildVideoSourceSnapshot } from './video-source-context';

const POLL_INTERVAL_MS = 1_000;
const CLEANUP_INTERVAL_MS = 60 * 60_000;
const MAX_RENDER_ATTEMPTS = 3;
const PLANNING_CONCURRENCY = 1;
const CANCELLATION_POLL_MS = 1_000;
const repository = new VideoGenerationRepository();
const workerId = `video-${randomUUID()}`;
let pollTimer: NodeJS.Timeout | null = null;
let cleanupTimer: NodeJS.Timeout | null = null;
let stopping = false;
let polling = false;
const runningPlanning = new Set<Promise<void>>();
const runningRendering = new Set<Promise<void>>();

export function initVideoGenerationWorker(): void {
  if (!env.VIDEO_GENERATION_ENABLED || pollTimer) return;
  stopping = false;
  pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS);
  cleanupTimer = setInterval(() => void cleanupExpiredDrafts(), CLEANUP_INTERVAL_MS);
  pollTimer.unref();
  cleanupTimer.unref();
  void poll();
  void cleanupExpiredDrafts();
  logger.info('AI video generation worker enabled', {
    planningConcurrency: PLANNING_CONCURRENCY,
    renderConcurrency: renderConcurrencyLimit(),
    frameConcurrency: env.VIDEO_FRAME_CONCURRENCY,
  });
}

export async function stopVideoGenerationWorker(): Promise<void> {
  stopping = true;
  if (pollTimer) clearInterval(pollTimer);
  if (cleanupTimer) clearInterval(cleanupTimer);
  pollTimer = null;
  cleanupTimer = null;
  await Promise.allSettled([...runningPlanning, ...runningRendering]);
}

async function poll(): Promise<void> {
  if (stopping || polling) return;
  polling = true;
  try {
    await fillWorkerSlots('PLANNING', runningPlanning, PLANNING_CONCURRENCY);
    await fillWorkerSlots('QUEUED', runningRendering, renderConcurrencyLimit());
  } finally {
    polling = false;
  }
}

async function fillWorkerSlots(
  status: 'PLANNING' | 'QUEUED',
  running: Set<Promise<void>>,
  limit: number,
): Promise<void> {
  while (!stopping && running.size < limit) {
    const job = await repository
      .claimNext(workerId, env.VIDEO_RENDER_TIMEOUT_MS + 120_000, [status])
      .catch((error: unknown) => {
        logger.error('Video queue claim failed', { error, status });
        return null;
      });
    if (!job) break;
    const task = processJob(job)
      .catch((error: unknown) => {
        logger.error('Unhandled video job error', { error, jobId: job.id });
      })
      .finally(() => running.delete(task));
    running.add(task);
  }
}

async function processJob(job: VideoGenerationJob): Promise<void> {
  const started = performance.now();
  try {
    if (job.status === 'PLANNING') await planStoryboard(job);
    else if (job.status === 'QUEUED') await renderVideo(job);
    logger.info('Video generation stage completed', {
      jobId: job.id,
      stage: job.status,
      durationMs: Math.round(performance.now() - started),
      queueDepth: await repository.countQueued().catch(() => -1),
    });
  } catch (error) {
    await handleFailure(job, error);
  } finally {
    await repository.releaseLease(job.id).catch(() => undefined);
  }
}

async function planStoryboard(job: VideoGenerationJob): Promise<void> {
  const lesson = await repository.findLessonForWorker(job.lessonId);
  if (!lesson) return;
  const snapshot = await buildVideoSourceSnapshot(lesson, jsonStringArray(job.selectedResourceIds));
  if (
    snapshot.contentVersion !== job.sourceContentVersion ||
    snapshot.fingerprint !== job.sourceFingerprint
  ) {
    await repository.update(job.id, {
      status: 'STALE',
      errorCode: 'SOURCE_CHANGED',
      errorMessage: 'Lesson content changed. Create a new video generation.',
      completedAt: new Date(),
    });
    return;
  }
  if (!snapshot.sources.some((source) => !source.isVisualOnly)) {
    throw new Error('No extractable lesson evidence is available.');
  }

  await repository.update(job.id, { progressPercent: 15 });
  const existing = parseStoryboard(job.storyboard);
  const response = await openAiVideoProvider.createStoryboard({
    snapshot,
    targetDurationSeconds: job.targetDurationSeconds,
    language: job.language,
    style: job.style,
    creativeInstructions: job.creativeInstructions,
    existingStoryboard: existing,
    sceneIds: jsonStringArray(job.regenerationSceneIds),
  });
  const storyboard = validateStoryboardForSources(
    response.storyboard,
    snapshot.sources.map((source) => source.id),
    true,
    snapshot.sources.filter((source) => !source.isVisualOnly).map((source) => source.id),
  );
  await repository.updateIfStatus(job.id, 'PLANNING', {
    status: 'STORYBOARD_READY',
    storyboard: storyboard as never,
    regenerationSceneIds: Prisma.JsonNull,
    inputTokens: { increment: response.inputTokens },
    outputTokens: { increment: response.outputTokens },
    progressPercent: 50,
    errorCode: null,
    errorMessage: null,
    leaseOwner: null,
    leaseExpiresAt: null,
  });
}

async function renderVideo(job: VideoGenerationJob): Promise<void> {
  const lesson = await repository.findLessonForWorker(job.lessonId);
  if (!lesson) return;
  const snapshot = await buildVideoSourceSnapshot(lesson, jsonStringArray(job.selectedResourceIds));
  if (
    snapshot.contentVersion !== job.sourceContentVersion ||
    snapshot.fingerprint !== job.sourceFingerprint
  ) {
    await repository.update(job.id, {
      status: 'STALE',
      errorCode: 'SOURCE_CHANGED',
      errorMessage: 'Lesson content changed. Create a new video generation.',
      completedAt: new Date(),
    });
    return;
  }
  const storyboard = parseStoryboard(job.storyboard);
  if (!storyboard) throw new Error('The approved storyboard is invalid or missing.');

  await repository.updateIfStatus(job.id, 'QUEUED', {
    status: 'SYNTHESIZING',
    progressPercent: Math.max(60, job.progressPercent),
    renderAttempts: { increment: 1 },
  });
  const priorAudio = parseAudioArtifacts(job.audioArtifacts);
  const audioArtifacts: AudioArtifact[] = [];
  for (const [index, scene] of storyboard.scenes.entries()) {
    if (await isCancelled(job.id)) {
      await deleteAudioArtifacts(audioArtifacts);
      return;
    }
    const hash = hashAudioInput(scene.narration, job.voice, job.language);
    const cached = priorAudio.find((artifact) => artifact.sceneId === scene.id && artifact.hash === hash);
    if (cached) audioArtifacts.push(cached);
    else {
      const audio = await openAiVideoProvider.synthesizeSpeech(scene.narration, job.voice, job.language);
      const durationSeconds = await measureMp3DurationSeconds(audio);
      const pointer = await storageProvider.save({
        buffer: audio,
        originalName: `${hash}.mp3`,
        entityType: 'video-generation-audio',
      });
      audioArtifacts.push({
        sceneId: scene.id,
        hash,
        relativePath: pointer.relativePath,
        durationSeconds,
        sizeBytes: audio.length,
      });
    }
    await repository.update(job.id, {
      progressPercent: Math.max(
        job.progressPercent,
        60 + Math.round(((index + 1) / storyboard.scenes.length) * 12),
      ),
      audioArtifacts: audioArtifacts as never,
    });
  }

  const synchronizedStoryboard = synchronizeStoryboardToAudio(storyboard, audioArtifacts);

  const moved = await repository.updateIfStatus(job.id, 'SYNTHESIZING', {
    status: 'RENDERING',
    progressPercent: Math.max(75, job.progressPercent),
    audioArtifacts: audioArtifacts as never,
    storyboard: synchronizedStoryboard as never,
  });
  if (moved.count !== 1) return;
  logger.info('Video narration synthesized', {
    jobId: job.id,
    audioDurationSeconds: synchronizedStoryboard.totalDurationSeconds,
    audioBytes: audioArtifacts.reduce((total, artifact) => total + (artifact.sizeBytes ?? 0), 0),
  });
  const selectedIds = new Set(jsonStringArray(job.selectedResourceIds));
  const visualAssets = lesson.resources
    .filter(
      (resource) =>
        (resource.type === 'IMAGE' || resource.type === 'PRESENTATION') &&
        resource.relativePath &&
        selectedIds.has(resource.id),
    )
    .map((resource) => ({
      sourceRef: `resource-${resource.id}`,
      relativePath: resource.relativePath as string,
      originalFilename: resource.originalFilename,
      type: resource.type as 'IMAGE' | 'PRESENTATION',
    }));
  const renderController = new AbortController();
  const cancellationTimer = setInterval(() => {
    void isCancelled(job.id)
      .then((cancelled) => {
        if (cancelled) renderController.abort();
      })
      .catch((error: unknown) => {
        logger.warn('Unable to check video render cancellation', { error, jobId: job.id });
      });
  }, CANCELLATION_POLL_MS);
  cancellationTimer.unref();
  let result: Awaited<ReturnType<typeof videoRendererService.render>>;
  let lastRenderProgress = Math.max(74, job.progressPercent);
  let lastProgressUpdateAt = 0;
  let progressUpdates = Promise.resolve();
  const frameConcurrency = frameConcurrencyForAttempt(job.renderAttempts);
  logger.info('Rendering lesson video', {
    jobId: job.id,
    attempt: job.renderAttempts + 1,
    frameConcurrency,
  });
  try {
    result = await videoRendererService.render(
      job.id,
      synchronizedStoryboard,
      audioArtifacts,
      job.style,
      visualAssets,
      frameConcurrency,
      renderController.signal,
      ({ stage, progress }) => {
        const nextProgress =
          stage === 'BUNDLING' ? 75 + Math.floor(progress * 3) : 78 + Math.floor(progress * 20);
        const now = Date.now();
        if (nextProgress <= lastRenderProgress || (nextProgress < 98 && now - lastProgressUpdateAt < 1_500)) {
          return;
        }
        lastRenderProgress = nextProgress;
        lastProgressUpdateAt = now;
        progressUpdates = progressUpdates
          .then(async () => {
            await repository.updateIfStatus(job.id, 'RENDERING', {
              progressPercent: nextProgress,
            });
          })
          .catch((error: unknown) => {
            logger.warn('Unable to update video render progress', { error, jobId: job.id });
          });
      },
    );
    await progressUpdates;
  } catch (error) {
    if (renderController.signal.aborted || (await isCancelled(job.id))) {
      await deleteAudioArtifacts(audioArtifacts);
      return;
    }
    throw error;
  } finally {
    clearInterval(cancellationTimer);
  }
  if (await isCancelled(job.id)) {
    await Promise.allSettled([
      storageProvider.delete(result.artifact),
      storageProvider.delete(result.captions),
      deleteAudioArtifacts(audioArtifacts),
    ]);
    return;
  }
  await repository.updateIfStatus(job.id, 'RENDERING', {
    status: 'READY',
    progressPercent: 100,
    artifactRelativePath: result.artifact.relativePath,
    captionRelativePath: result.captions.relativePath,
    artifactMimeType: 'video/mp4',
    artifactSizeBytes: result.sizeBytes,
    completedAt: new Date(),
    errorCode: null,
    errorMessage: null,
    leaseOwner: null,
    leaseExpiresAt: null,
  });
}

async function handleFailure(original: VideoGenerationJob, error: unknown): Promise<void> {
  const current = await repository.findById(original.id).catch(() => null);
  if (!current || current.status === 'CANCELLED' || current.status === 'STALE') return;
  const isRenderStage = ['QUEUED', 'SYNTHESIZING', 'RENDERING'].includes(current.status);
  const retry =
    isRenderStage && current.renderAttempts < MAX_RENDER_ATTEMPTS && isRetryableRenderFailure(error);
  const safeMessage = retry
    ? 'A rendering attempt failed and will retry automatically.'
    : original.status === 'PLANNING'
      ? 'The storyboard could not be generated. Try regenerating it.'
      : 'The video could not be rendered. Try again or contact an administrator.';
  logger.error('Video generation stage failed', {
    jobId: original.id,
    stage: current.status,
    attempt: current.renderAttempts,
    error: error instanceof Error ? error.message : error,
  });
  if (!retry) await cleanupJobArtifacts(current);
  await repository.update(original.id, {
    status: retry ? 'QUEUED' : 'FAILED',
    progressPercent: retry ? Math.max(55, current.progressPercent) : current.progressPercent,
    errorCode: retry ? 'RETRYING_RENDER' : 'GENERATION_FAILED',
    errorMessage: safeMessage,
    completedAt: retry ? null : new Date(),
    ...(retry
      ? {}
      : {
          artifactRelativePath: null,
          captionRelativePath: null,
          thumbnailRelativePath: null,
          artifactMimeType: null,
          artifactSizeBytes: null,
          audioArtifacts: Prisma.JsonNull,
        }),
    leaseOwner: null,
    leaseExpiresAt: null,
  });
}

export function isRetryableRenderFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  const message = error.message.toLowerCase();
  return ![
    'status code of 404',
    'could not be found',
    'approved storyboard is invalid or missing',
    'exceeds the lesson resource storage limit',
    'rendering cancelled',
  ].some((pattern) => message.includes(pattern));
}

export function frameConcurrencyForAttempt(
  previousAttempts: number,
  configured: number | string = env.VIDEO_FRAME_CONCURRENCY,
): number | string {
  if (previousAttempts <= 0) return configured;
  if (typeof configured === 'number') return Math.max(1, configured - previousAttempts);
  const percentage = Number.parseInt(configured, 10);
  if (!Number.isFinite(percentage)) return 1;
  return previousAttempts === 1 ? `${Math.max(20, Math.floor(percentage / 2))}%` : 1;
}

async function cleanupExpiredDrafts(): Promise<void> {
  const expired = await repository.findExpiredDrafts(new Date()).catch((error: unknown) => {
    logger.error('Video draft cleanup query failed', { error });
    return [];
  });
  for (const job of expired) {
    const audio = parseAudioArtifacts(job.audioArtifacts);
    const paths = [
      job.artifactRelativePath,
      job.captionRelativePath,
      job.thumbnailRelativePath,
      ...audio.map((artifact) => artifact.relativePath),
    ].filter((value): value is string => Boolean(value));
    await Promise.allSettled(paths.map((relativePath) => storageProvider.delete({ relativePath })));
    await repository
      .update(job.id, {
        status: job.status === 'READY' || job.status === 'STORYBOARD_READY' ? 'CANCELLED' : job.status,
        artifactRelativePath: null,
        captionRelativePath: null,
        thumbnailRelativePath: null,
        audioArtifacts: Prisma.JsonNull,
        errorCode: job.errorCode ?? 'DRAFT_EXPIRED',
        errorMessage: job.errorMessage ?? 'This unapproved video draft expired after the retention period.',
        expiresAt: null,
      })
      .catch(() => undefined);
  }
}

function parseStoryboard(value: unknown): VideoStoryboardV1 | null {
  const parsed = videoStoryboardSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseAudioArtifacts(value: unknown): AudioArtifact[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is AudioArtifact =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as AudioArtifact).sceneId === 'string' &&
      typeof (entry as AudioArtifact).hash === 'string' &&
      typeof (entry as AudioArtifact).relativePath === 'string',
  );
}

function jsonStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

async function isCancelled(jobId: string): Promise<boolean> {
  const job = await repository.findById(jobId);
  return !job || job.status === 'CANCELLED';
}

async function deleteAudioArtifacts(artifacts: AudioArtifact[]): Promise<void> {
  await Promise.allSettled(
    artifacts.map((artifact) => storageProvider.delete({ relativePath: artifact.relativePath })),
  );
}

async function cleanupJobArtifacts(job: VideoGenerationJob): Promise<void> {
  const paths = [
    job.artifactRelativePath,
    job.captionRelativePath,
    job.thumbnailRelativePath,
    ...parseAudioArtifacts(job.audioArtifacts).map((artifact) => artifact.relativePath),
  ].filter((value): value is string => Boolean(value));
  await Promise.allSettled(paths.map((relativePath) => storageProvider.delete({ relativePath })));
}

function renderConcurrencyLimit(): number {
  return Math.max(1, Math.min(4, env.VIDEO_RENDER_CONCURRENCY));
}
