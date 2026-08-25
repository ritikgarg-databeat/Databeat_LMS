export type VideoGenerationStatus =
  | 'PLANNING'
  | 'STORYBOARD_READY'
  | 'QUEUED'
  | 'SYNTHESIZING'
  | 'RENDERING'
  | 'READY'
  | 'PUBLISHED'
  | 'FAILED'
  | 'CANCELLED'
  | 'STALE';

export type VideoStyle = 'CLEAN_CORPORATE' | 'VISUAL_EXPLAINER' | 'CODE_WALKTHROUGH';
export type VideoSceneType =
  'TITLE' | 'CONCEPT' | 'STEPS' | 'COMPARISON' | 'TIMELINE' | 'DIAGRAM' | 'CODE' | 'CALLOUT' | 'SUMMARY';

export interface VideoStoryboardScene {
  id: string;
  type: VideoSceneType;
  heading: string;
  narration: string;
  bullets: string[];
  visualDirection: string;
  visualPreset: 'FADE_UP' | 'SLIDE_IN' | 'STAGGERED_CARDS' | 'FOCUS_CALLOUT' | 'CODE_REVEAL';
  durationSeconds: number;
  sourceRefs: string[];
}

export interface VideoStoryboardV1 {
  version: 1;
  title: string;
  language: string;
  totalDurationSeconds: number;
  scenes: VideoStoryboardScene[];
}

export interface VideoGenerationJob {
  id: string;
  lessonId: string;
  purpose: 'LESSON_RESOURCE' | 'TRAINEE_EXPLANATION';
  status: VideoGenerationStatus;
  sourceContentVersion: number;
  settings: {
    selectedResourceIds: string[];
    creativeInstructions: string | null;
    targetDurationSeconds: number;
    language: string;
    voice: string;
    style: VideoStyle;
  };
  storyboard: VideoStoryboardV1 | null;
  progress: number;
  error: { code: string; message: string | null } | null;
  tokenUsage: { input: number; output: number };
  renderAttempts: number;
  hasPreview: boolean;
  publishedResourceId: string | null;
  publishedContentVersion: number | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoSourceOption {
  id: string;
  sourceRef: string;
  title: string;
  type: string;
  filename: string | null;
  supported: true;
}

export interface VideoSourcesResponse {
  enabled: boolean;
  lessonTitle?: string;
  contentVersion?: number;
  hasDescription?: boolean;
  sources: VideoSourceOption[];
  warnings: string[];
  defaults?: {
    targetDurationSeconds: number;
    maxDurationSeconds: number;
    language: string;
    voice: string;
    style: VideoStyle;
  };
}

export interface CreateVideoGenerationPayload {
  selectedResourceIds: string[];
  creativeInstructions?: string;
  targetDurationSeconds: number;
  language: string;
  voice: string;
  style: VideoStyle;
}

export interface PublishVideoResult {
  resource: { id: string; title: string; type: 'VIDEO' };
  contentVersion: number;
  reopenedLearnerCount: number;
}
