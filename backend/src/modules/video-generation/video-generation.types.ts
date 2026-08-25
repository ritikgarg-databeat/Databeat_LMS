import { z } from 'zod';

export const VIDEO_SCENE_TYPES = [
  'TITLE',
  'CONCEPT',
  'STEPS',
  'COMPARISON',
  'TIMELINE',
  'DIAGRAM',
  'CODE',
  'CALLOUT',
  'SUMMARY',
] as const;

export const VIDEO_VISUAL_PRESETS = [
  'FADE_UP',
  'SLIDE_IN',
  'STAGGERED_CARDS',
  'FOCUS_CALLOUT',
  'CODE_REVEAL',
] as const;

export const VIDEO_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'onyx',
  'nova',
  'sage',
  'shimmer',
  'verse',
  'marin',
  'cedar',
] as const;

export const videoStoryboardSceneSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(VIDEO_SCENE_TYPES),
  heading: z.string().min(1).max(140),
  narration: z.string().min(1).max(4096),
  bullets: z.array(z.string().min(1).max(240)).max(8),
  visualDirection: z.string().min(1).max(500),
  visualPreset: z.enum(VIDEO_VISUAL_PRESETS),
  durationSeconds: z.number().min(1).max(120),
  sourceRefs: z.array(z.string().min(1).max(100)).min(1).max(12),
});

export const videoStoryboardSchema = z.object({
  version: z.literal(1),
  title: z.string().min(1).max(180),
  language: z.string().min(2).max(50),
  totalDurationSeconds: z.number().min(1),
  scenes: z.array(videoStoryboardSceneSchema).min(2).max(40),
});

export type VideoStoryboardV1 = z.infer<typeof videoStoryboardSchema>;
export type VideoStoryboardScene = z.infer<typeof videoStoryboardSceneSchema>;

export interface VideoGroundingSource {
  id: string;
  resourceId: string | null;
  label: string;
  type: string;
  content: string;
  isVisualOnly?: boolean;
  warning?: string;
}

export interface VideoSourceSnapshot {
  lessonId: string;
  lessonTitle: string;
  lessonDescription?: string;
  contentVersion: number;
  fingerprint: string;
  selectedResourceIds: string[];
  sources: VideoGroundingSource[];
  warnings: string[];
}

export interface AudioArtifact {
  sceneId: string;
  hash: string;
  relativePath: string;
  durationSeconds: number;
  sizeBytes?: number;
}

export interface VideoGenerationSettings {
  selectedResourceIds: string[];
  creativeInstructions?: string;
  targetDurationSeconds: number;
  language: string;
  voice: (typeof VIDEO_VOICES)[number];
  style: 'CLEAN_CORPORATE' | 'VISUAL_EXPLAINER' | 'CODE_WALKTHROUGH';
}

export const ACTIVE_VIDEO_JOB_STATUSES = [
  'PLANNING',
  'STORYBOARD_READY',
  'QUEUED',
  'SYNTHESIZING',
  'RENDERING',
  'READY',
] as const;

export const TERMINAL_VIDEO_JOB_STATUSES = ['PUBLISHED', 'FAILED', 'CANCELLED', 'STALE'] as const;
