import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { videoGenerationsApi } from '../services';
import type { CreateVideoGenerationPayload, VideoStoryboardV1 } from '../types';

const SOURCES_KEY = 'classroom-video-sources';
const JOBS_KEY = 'classroom-video-jobs';
const ACTIVE_STATUSES = new Set(['PLANNING', 'QUEUED', 'SYNTHESIZING', 'RENDERING']);

export function useVideoSourcesQuery(lessonId: string) {
  return useQuery({
    queryKey: [SOURCES_KEY, lessonId],
    queryFn: () => videoGenerationsApi.sources(lessonId),
    staleTime: 30_000,
  });
}

export function useVideoJobsQuery(lessonId: string, enabled: boolean) {
  return useQuery({
    queryKey: [JOBS_KEY, lessonId],
    queryFn: () => videoGenerationsApi.list(lessonId),
    enabled,
    refetchInterval: (query) =>
      query.state.data?.jobs.some((job) => ACTIVE_STATUSES.has(job.status)) ? 2_000 : false,
  });
}

function useRefreshVideoJobs(lessonId: string) {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: [JOBS_KEY, lessonId] });
}

export function useCreateVideoGeneration(lessonId: string) {
  const refresh = useRefreshVideoJobs(lessonId);
  return useMutation({
    mutationFn: (payload: CreateVideoGenerationPayload) => videoGenerationsApi.create(lessonId, payload),
    onSuccess: refresh,
  });
}

export function useSaveVideoStoryboard(lessonId: string) {
  const refresh = useRefreshVideoJobs(lessonId);
  return useMutation({
    mutationFn: ({ jobId, storyboard }: { jobId: string; storyboard: VideoStoryboardV1 }) =>
      videoGenerationsApi.saveStoryboard(lessonId, jobId, storyboard),
    onSuccess: refresh,
  });
}

export function useRegenerateVideo(lessonId: string) {
  const refresh = useRefreshVideoJobs(lessonId);
  return useMutation({
    mutationFn: ({ jobId, sceneIds }: { jobId: string; sceneIds?: string[] }) =>
      videoGenerationsApi.regenerate(lessonId, jobId, sceneIds),
    onSuccess: refresh,
  });
}

export function useRenderVideo(lessonId: string) {
  const refresh = useRefreshVideoJobs(lessonId);
  return useMutation({
    mutationFn: (jobId: string) => videoGenerationsApi.render(lessonId, jobId),
    onSuccess: refresh,
  });
}

export function usePublishVideo(lessonId: string) {
  const refresh = useRefreshVideoJobs(lessonId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => videoGenerationsApi.publish(lessonId, jobId),
    onSuccess: () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: ['classroom-lesson-resources', lessonId] });
      void queryClient.invalidateQueries({ queryKey: ['classroom-lesson', lessonId] });
      void queryClient.invalidateQueries({ queryKey: ['classroom-my-courses'] });
      void queryClient.invalidateQueries({ queryKey: ['classroom-continue-learning'] });
    },
  });
}

export function useCancelVideo(lessonId: string) {
  const refresh = useRefreshVideoJobs(lessonId);
  return useMutation({
    mutationFn: (jobId: string) => videoGenerationsApi.cancel(lessonId, jobId),
    onSuccess: refresh,
  });
}

export function useVideoPreviewQuery(lessonId: string, jobId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['classroom-video-preview', lessonId, jobId],
    queryFn: () => videoGenerationsApi.preview(lessonId, jobId as string),
    enabled: enabled && Boolean(jobId),
    staleTime: Infinity,
  });
}
