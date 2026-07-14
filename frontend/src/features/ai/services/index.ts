// API calls for the ai feature, built on the shared Axios client.
import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse, PaginatedData } from '@/types/api';

import type {
  AiConversationDetail,
  AiConversationListItem,
  AiUsageOverview,
  ChatRequestPayload,
  ChatResponse,
  ListAiHistoryParams,
} from '../types';

export const aiApi = {
  /**
   * Sends a message to the AI Learning Assistant. Omit `conversationId` to start a new
   * conversation (optionally scoped to `lessonId`); provide it to continue an existing one.
   *
   * Not guaranteed to succeed — the backend returns 503 when `ANTHROPIC_API_KEY` isn't
   * configured, and 429 when the per-user rate limit is exceeded. Both flow through the normal
   * axios-throws-on-non-2xx path like any other error; callers should catch and surface via
   * `getErrorMessage`.
   */
  async chat(payload: ChatRequestPayload): Promise<ChatResponse> {
    const { data } = await apiClient.post<ApiSuccessResponse<ChatResponse>>('/ai/chat', payload);
    return data.data;
  },

  async getHistory(params: ListAiHistoryParams): Promise<PaginatedData<AiConversationListItem>> {
    const { data } = await apiClient.get<ApiSuccessResponse<PaginatedData<AiConversationListItem>>>(
      '/ai/history',
      { params },
    );
    return data.data;
  },

  async getConversation(conversationId: string): Promise<AiConversationDetail> {
    const { data } = await apiClient.get<ApiSuccessResponse<AiConversationDetail>>(
      `/ai/conversations/${conversationId}`,
    );
    return data.data;
  },

  /** Deletes ALL of the current user's conversations. */
  async clearHistory(): Promise<void> {
    await apiClient.delete('/ai/history');
  },

  /** Deletes a single conversation. Must be owned by the caller (403/404 otherwise). */
  async deleteConversation(conversationId: string): Promise<void> {
    await apiClient.delete(`/ai/conversations/${conversationId}`);
  },

  /** Trainer/Super-Admin only (403 for trainees) — org-wide usage aggregates. */
  async getUsage(): Promise<AiUsageOverview> {
    const { data } = await apiClient.get<ApiSuccessResponse<AiUsageOverview>>('/ai/usage');
    return data.data;
  },
};
