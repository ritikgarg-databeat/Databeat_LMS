// React hooks (including TanStack Query hooks) for the ai feature.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { aiApi } from '../services';
import type { ChatRequestPayload, CreateAiVideoPayload, ListAiHistoryParams } from '../types';

export const AI_HISTORY_QUERY_KEY = 'ai-history';
export const AI_CONVERSATION_QUERY_KEY = 'ai-conversation';
export const AI_USAGE_QUERY_KEY = 'ai-usage';
export const AI_VIDEO_QUERY_KEY = 'ai-video';

/* -------------------------------------------------------------------------- */
/* Queries                                                                     */
/* -------------------------------------------------------------------------- */

export function useAiHistoryQuery(params: ListAiHistoryParams) {
  return useQuery({
    queryKey: [AI_HISTORY_QUERY_KEY, params],
    queryFn: () => aiApi.getHistory(params),
    placeholderData: (previous) => previous,
  });
}

export function useAiConversationQuery(conversationId: string | undefined) {
  return useQuery({
    queryKey: [AI_CONVERSATION_QUERY_KEY, conversationId],
    queryFn: () => aiApi.getConversation(conversationId as string),
    enabled: Boolean(conversationId),
  });
}

/** Trainer/Super-Admin only — mount only on staff surfaces (the API 403s for trainees). */
export function useAiUsageQuery() {
  return useQuery({
    queryKey: [AI_USAGE_QUERY_KEY],
    queryFn: () => aiApi.getUsage(),
  });
}

/* -------------------------------------------------------------------------- */
/* Invalidation helpers                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Shared invalidation used by every mutation below. `conversationId`, when known, also
 * invalidates that conversation's detail query (e.g. after sending a chat message into an
 * existing conversation); the history list is always invalidated broadly (all pages/params)
 * since `invalidateQueries` does a queryKey prefix match.
 */
function useInvalidateAiQueries() {
  const queryClient = useQueryClient();
  return (conversationId?: string) => {
    void queryClient.invalidateQueries({ queryKey: [AI_HISTORY_QUERY_KEY] });
    if (conversationId) {
      void queryClient.invalidateQueries({ queryKey: [AI_CONVERSATION_QUERY_KEY, conversationId] });
    }
  };
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Hook factory — call this once per call site (never share a single instance across a
 * click-driven send button and an effect-driven call). Sharing one `useMutation` instance
 * between an effect-fired call and a user-click-driven call can leave that instance's
 * `isPending` stuck under StrictMode's dev-only double-invocation of effects (see
 * `useUpsertLessonProgressMutation` usage in `features/classroom/pages/lesson-viewer-page.tsx`
 * for the established pattern of using separate instances per call site).
 */
export function useAiChatMutation() {
  const invalidate = useInvalidateAiQueries();
  return useMutation({
    mutationFn: (payload: ChatRequestPayload) => aiApi.chat(payload),
    onSuccess: (data) => invalidate(data.conversationId),
  });
}

export function useAiVideoMutation() {
  const invalidate = useInvalidateAiQueries();
  return useMutation({
    mutationFn: (payload: CreateAiVideoPayload) => aiApi.createVideo(payload),
    onSuccess: (data) => invalidate(data.conversationId),
  });
}

export function useAiVideoQuery(jobId: string | undefined) {
  return useQuery({
    queryKey: [AI_VIDEO_QUERY_KEY, jobId],
    queryFn: () => aiApi.getVideo(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ['PLANNING', 'QUEUED', 'SYNTHESIZING', 'RENDERING'].includes(status) ? 2_000 : false;
    },
  });
}

export function useAiVideoPreviewQuery(jobId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['ai-video-preview', jobId],
    queryFn: () => aiApi.getVideoPreview(jobId as string),
    enabled: enabled && Boolean(jobId),
    staleTime: Infinity,
  });
}

export function useRetryAiVideoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => aiApi.retryVideo(jobId),
    onSuccess: (job) => {
      queryClient.setQueryData([AI_VIDEO_QUERY_KEY, job.id], job);
    },
  });
}

export function useClearAiHistoryMutation() {
  const invalidate = useInvalidateAiQueries();
  return useMutation({
    mutationFn: () => aiApi.clearHistory(),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteAiConversationMutation() {
  const invalidate = useInvalidateAiQueries();
  return useMutation({
    mutationFn: (conversationId: string) => aiApi.deleteConversation(conversationId),
    onSuccess: (_data, conversationId) => invalidate(conversationId),
  });
}
