import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse } from '@/types/api';

import type {
  CreateVideoGenerationPayload,
  PublishVideoResult,
  VideoGenerationJob,
  VideoSourcesResponse,
  VideoStoryboardV1,
} from '../types';

const root = (lessonId: string) => `/lessons/${lessonId}/video-generations`;

export const videoGenerationsApi = {
  async sources(lessonId: string): Promise<VideoSourcesResponse> {
    const { data } = await apiClient.get<ApiSuccessResponse<VideoSourcesResponse>>(
      `${root(lessonId)}/sources`,
    );
    return data.data;
  },
  async list(lessonId: string): Promise<{ enabled: boolean; jobs: VideoGenerationJob[] }> {
    const { data } = await apiClient.get<
      ApiSuccessResponse<{ enabled: boolean; jobs: VideoGenerationJob[] }>
    >(root(lessonId));
    return data.data;
  },
  async create(lessonId: string, payload: CreateVideoGenerationPayload): Promise<VideoGenerationJob> {
    const { data } = await apiClient.post<ApiSuccessResponse<VideoGenerationJob>>(root(lessonId), payload);
    return data.data;
  },
  async saveStoryboard(lessonId: string, jobId: string, storyboard: VideoStoryboardV1) {
    const { data } = await apiClient.patch<ApiSuccessResponse<VideoGenerationJob>>(
      `${root(lessonId)}/${jobId}/storyboard`,
      { storyboard },
    );
    return data.data;
  },
  async regenerate(lessonId: string, jobId: string, sceneIds?: string[]) {
    const { data } = await apiClient.post<ApiSuccessResponse<VideoGenerationJob>>(
      `${root(lessonId)}/${jobId}/regenerate`,
      sceneIds?.length ? { sceneIds } : {},
    );
    return data.data;
  },
  async render(lessonId: string, jobId: string) {
    const { data } = await apiClient.post<ApiSuccessResponse<VideoGenerationJob>>(
      `${root(lessonId)}/${jobId}/render`,
    );
    return data.data;
  },
  async preview(lessonId: string, jobId: string): Promise<Blob> {
    const { data } = await apiClient.get<Blob>(`${root(lessonId)}/${jobId}/preview`, {
      responseType: 'blob',
    });
    return data;
  },
  async publish(lessonId: string, jobId: string): Promise<PublishVideoResult> {
    const { data } = await apiClient.post<ApiSuccessResponse<PublishVideoResult>>(
      `${root(lessonId)}/${jobId}/publish`,
    );
    return data.data;
  },
  async cancel(lessonId: string, jobId: string): Promise<void> {
    await apiClient.post(`${root(lessonId)}/${jobId}/cancel`);
  },
};
