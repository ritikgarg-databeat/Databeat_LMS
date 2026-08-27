// API calls for the qna (Q&A Discussion Platform) feature, built on the shared Axios client.
//
// Mirrors backend/src/modules/qna's five sub-resources — questions, answers, comments, votes,
// tags — plus the cross-resource `/qna/search` endpoint. Grouped into namespaced objects the same
// way features/assessment/services/index.ts groups questions/assessments/attempts.
import { env } from '@/config/env';
import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse, PaginatedData } from '@/types/api';

import type {
  AttachmentUploadResult,
  CreateAnswerPayload,
  CreateCommentPayload,
  CreateCommentResult,
  CreateQuestionPayload,
  ListQuestionsParams,
  ListTagsParams,
  PinAnswerPayload,
  QnaAnswer,
  QnaQuestionDetail,
  QnaQuestionListItem,
  QnaSearchResult,
  QnaTag,
  SearchParams,
  ToggleVotePayload,
  UpdateAnswerPayload,
  UpdateQuestionPayload,
  UpdateQuestionStatusPayload,
  VerifyAnswerPayload,
  VoteToggleResult,
} from '../types';

export const qnaQuestionsApi = {
  async list(params: ListQuestionsParams): Promise<PaginatedData<QnaQuestionListItem>> {
    const { data } = await apiClient.get<ApiSuccessResponse<PaginatedData<QnaQuestionListItem>>>(
      '/qna/questions',
      {
        params,
      },
    );
    return data.data;
  },

  async create(payload: CreateQuestionPayload): Promise<QnaQuestionDetail> {
    const { data } = await apiClient.post<ApiSuccessResponse<QnaQuestionDetail>>('/qna/questions', payload);
    return data.data;
  },

  async getById(id: string): Promise<QnaQuestionDetail> {
    const { data } = await apiClient.get<ApiSuccessResponse<QnaQuestionDetail>>(`/qna/questions/${id}`);
    return data.data;
  },

  /** Partial update — any subset of fields. */
  async update(id: string, payload: UpdateQuestionPayload): Promise<QnaQuestionDetail> {
    const { data } = await apiClient.put<ApiSuccessResponse<QnaQuestionDetail>>(
      `/qna/questions/${id}`,
      payload,
    );
    return data.data;
  },

  /** Soft delete — 204 No Content. */
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/qna/questions/${id}`);
  },

  async updateStatus(id: string, payload: UpdateQuestionStatusPayload): Promise<QnaQuestionDetail> {
    const { data } = await apiClient.patch<ApiSuccessResponse<QnaQuestionDetail>>(
      `/qna/questions/${id}/status`,
      payload,
    );
    return data.data;
  },

  async uploadAttachment(id: string, file: File): Promise<AttachmentUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post<ApiSuccessResponse<AttachmentUploadResult>>(
      `/qna/questions/${id}/attachments`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data.data;
  },

  /** 204 No Content. */
  async removeAttachment(id: string, attachmentId: string): Promise<void> {
    await apiClient.delete(`/qna/questions/${id}/attachments/${attachmentId}`);
  },

  /**
   * Builds the raw download URL for `GET /qna/questions/:id/attachments/:attachmentId/download`.
   * That endpoint streams file bytes (`Content-Disposition: attachment`), NOT the usual JSON
   * envelope — so unlike every other method here, there's no `apiClient` call / `.data.data`
   * unwrap; this just returns a URL string for a page to use.
   *
   * KNOWN LIMITATION (flagging, not fixing, per current spec): this route requires the same
   * `Authorization: Bearer` header as every other `/qna/*` endpoint, but the access token is
   * deliberately kept in-memory only — never in localStorage or a readable cookie (see
   * `services/api/client.ts`'s comment on the module-level `accessToken` variable). A plain
   * `<a href={url}>` click navigates the browser straight to this URL with no way to attach that
   * header, so it will 401. Two ways to actually resolve this later:
   *   (a) (more likely the real fix, no backend change needed) fetch it as a blob through the
   *       authenticated axios client instead of linking directly:
   *       `const { data } = await apiClient.get(url, { responseType: 'blob' })`, then
   *       `URL.createObjectURL(data)` and click a synthetic `<a>` — see
   *       `features/classroom/hooks/index.ts`'s `useDownloadResource` for the exact pattern; or
   *   (b) have the backend accept a short-lived signed URL / token query param for this route.
   */
  getAttachmentDownloadUrl(questionId: string, attachmentId: string): string {
    return `${env.API_URL}/qna/questions/${questionId}/attachments/${attachmentId}/download`;
  },

  /** Body targets an answerId, but the URL path uses the QUESTION id. Returns the now-verified `QnaAnswer`. */
  async verifyAnswer(id: string, payload: VerifyAnswerPayload): Promise<QnaAnswer> {
    const { data } = await apiClient.post<ApiSuccessResponse<QnaAnswer>>(
      `/qna/questions/${id}/verify-answer`,
      payload,
    );
    return data.data;
  },
};

export const qnaAnswersApi = {
  async create(payload: CreateAnswerPayload): Promise<QnaAnswer> {
    const { data } = await apiClient.post<ApiSuccessResponse<QnaAnswer>>('/qna/answers', payload);
    return data.data;
  },

  async update(id: string, payload: UpdateAnswerPayload): Promise<QnaAnswer> {
    const { data } = await apiClient.put<ApiSuccessResponse<QnaAnswer>>(`/qna/answers/${id}`, payload);
    return data.data;
  },

  /** 204 No Content. */
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/qna/answers/${id}`);
  },

  async pin(id: string, payload: PinAnswerPayload): Promise<QnaAnswer> {
    const { data } = await apiClient.patch<ApiSuccessResponse<QnaAnswer>>(`/qna/answers/${id}/pin`, payload);
    return data.data;
  },
};

export const qnaCommentsApi = {
  async create(payload: CreateCommentPayload): Promise<CreateCommentResult> {
    const { data } = await apiClient.post<ApiSuccessResponse<CreateCommentResult>>('/qna/comments', payload);
    return data.data;
  },

  /** 204 No Content. */
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/qna/comments/${id}`);
  },
};

export const qnaVotesApi = {
  /** Toggle, not a pure create — calling this again on the same target removes the vote. */
  async toggle(payload: ToggleVotePayload): Promise<VoteToggleResult> {
    const { data } = await apiClient.post<ApiSuccessResponse<VoteToggleResult>>('/qna/votes', payload);
    return data.data;
  },
};

export const qnaTagsApi = {
  /** Plain array response — NOT paginated. */
  async list(params?: ListTagsParams): Promise<QnaTag[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<QnaTag[]>>('/qna/tags', { params });
    return data.data;
  },
};

export const qnaSearchApi = {
  async search(params: SearchParams): Promise<QnaSearchResult> {
    const { data } = await apiClient.get<ApiSuccessResponse<QnaSearchResult>>('/qna/search', { params });
    return data.data;
  },
};
