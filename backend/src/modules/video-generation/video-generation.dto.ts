import type { VideoStoryboardV1 } from './video-generation.types';

export interface CreateVideoGenerationDto {
  selectedResourceIds?: string[];
  creativeInstructions?: string;
  targetDurationSeconds?: number;
  language?: string;
  voice?: string;
  style?: 'CLEAN_CORPORATE' | 'VISUAL_EXPLAINER' | 'CODE_WALKTHROUGH';
}

export interface UpdateVideoStoryboardDto {
  storyboard: VideoStoryboardV1;
}

export interface RegenerateVideoDto {
  sceneIds?: string[];
}
