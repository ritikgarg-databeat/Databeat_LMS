import { env } from '@/config/env';

import {
  videoStoryboardSchema,
  type AudioArtifact,
  type TimedCaptionWord,
  type VideoStoryboardScene,
  type VideoStoryboardV1,
} from './video-generation.types';

const VIDEO_FPS = 30;

export function traineeVideoUtcDayWindow(now: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export function effectiveTraineeVideoLimit(platformLimit: number, trainerLimits: number[]): number {
  return Math.min(platformLimit, ...trainerLimits);
}

export function normalizeTimedCaptionWords(
  words: TimedCaptionWord[],
  durationSeconds: number,
): TimedCaptionWord[] {
  return words.flatMap((word) => {
    const startSeconds = Math.max(0, word.startSeconds);
    const endSeconds = Math.min(durationSeconds, word.endSeconds);
    return startSeconds < durationSeconds && endSeconds > startSeconds
      ? [{ ...word, startSeconds, endSeconds }]
      : [];
  });
}

export function calculateStoryboardDuration(scenes: VideoStoryboardScene[]): number {
  return scenes.reduce((total, scene) => total + scene.durationSeconds, 0);
}

export function createVideoPromptCacheKey(sourceFingerprint: string): string {
  return sourceFingerprint.slice(0, 64);
}

export function synchronizeStoryboardToAudio(
  storyboard: VideoStoryboardV1,
  audioArtifacts: AudioArtifact[],
): VideoStoryboardV1 {
  const durationByScene = new Map(
    audioArtifacts.map((artifact) => [artifact.sceneId, artifact.durationSeconds]),
  );
  const scenes = storyboard.scenes.map((scene) => {
    const audioDuration = durationByScene.get(scene.id);
    if (!audioDuration || !Number.isFinite(audioDuration)) {
      throw new Error(`Narration audio is missing for scene ${scene.id}.`);
    }
    return {
      ...scene,
      durationSeconds: Math.max(1, Math.ceil(audioDuration * VIDEO_FPS) / VIDEO_FPS),
    };
  });
  return {
    ...storyboard,
    scenes,
    totalDurationSeconds: Number(calculateStoryboardDuration(scenes).toFixed(3)),
  };
}

export function validateStoryboardForSources(
  input: unknown,
  validSourceIds: string[],
  normalizeTotal = false,
  factualSourceIds: string[] = validSourceIds,
): VideoStoryboardV1 {
  const parsed = videoStoryboardSchema.parse(input);
  const sceneIds = new Set<string>();
  const sourceIds = new Set(validSourceIds);
  const factualIds = new Set(factualSourceIds);
  for (const scene of parsed.scenes) {
    if (sceneIds.has(scene.id)) throw new Error('Storyboard contains duplicate scene IDs.');
    sceneIds.add(scene.id);
    if (scene.sourceRefs.some((reference) => !sourceIds.has(reference))) {
      throw new Error('Storyboard references evidence outside the lesson.');
    }
    if (!scene.sourceRefs.some((reference) => factualIds.has(reference))) {
      throw new Error('Storyboard scene is not grounded in factual lesson evidence.');
    }
  }
  const duration = calculateStoryboardDuration(parsed.scenes);
  if (!normalizeTotal && parsed.totalDurationSeconds !== duration) {
    throw new Error('Storyboard duration does not match its scenes.');
  }
  if (duration < 60 || duration > env.VIDEO_MAX_DURATION_SECONDS) {
    throw new Error('Storyboard duration is outside the allowed range.');
  }
  return normalizeTotal ? { ...parsed, totalDurationSeconds: duration } : parsed;
}

export function createWebVttCaptions(storyboard: VideoStoryboardV1, audioArtifacts: AudioArtifact[]): string {
  let start = 0;
  let cueIndex = 0;
  const wordsByScene = new Map(
    audioArtifacts.map((artifact) => [artifact.sceneId, artifact.captionWords ?? []]),
  );
  const cues = storyboard.scenes.flatMap((scene) => {
    const sceneStart = start;
    start += scene.durationSeconds;
    const words = wordsByScene.get(scene.id) ?? [];
    const chunks: (typeof words)[] = [];
    for (let index = 0; index < words.length; index += 8) chunks.push(words.slice(index, index + 8));
    return chunks.flatMap((chunk) => {
      const first = chunk[0];
      const last = chunk.at(-1);
      if (!first || !last) return [];
      cueIndex += 1;
      return `${cueIndex}\n${timestamp(sceneStart + first.startSeconds)} --> ${timestamp(sceneStart + last.endSeconds)}\n${chunk.map((word) => word.word).join(' ')}\n`;
    });
  });
  return `WEBVTT\n\n${cues.join('\n')}`;
}

function timestamp(seconds: number): string {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((totalMilliseconds % 60_000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}
