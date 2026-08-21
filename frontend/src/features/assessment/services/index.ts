// API calls for the assessment feature, built on the shared Axios client.
//
// Three namespaced objects, one per backend module: `questionsApi` (`/questions`), `assessmentsApi`
// (`/assessments`), and `assessmentAttemptsApi` (`/assessments/:id/attempts`, nested — every
// method takes the assessmentId as its first parameter, mirroring how the backend controller
// reads it off `req.params.id`).
import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse, PaginatedData } from '@/types/api';

import type {
  AddQuestionPayload,
  Assessment,
  AssessmentDetail,
  AssessmentGroupAssignment,
  AssessmentGroupAssignmentSummary,
  AssessmentListParams,
  AssessmentQuestion,
  AssessmentStats,
  AssessmentSummary,
  AssignGroupPayload,
  Attempt,
  AttemptDetail,
  AttemptListParams,
  AttemptStartResponse,
  AttemptSummary,
  CreateAssessmentPayload,
  CreateQuestionPayload,
  DuplicateAssessmentPayload,
  GradeAnswerPayload,
  GradeAnswerResult,
  MyAssessmentSummary,
  MyAttemptResponse,
  Question,
  QuestionListParams,
  QuestionSummary,
  ReorderQuestionsPayload,
  SavedAnswer,
  UpdateAssessmentPayload,
  UpdateAssessmentQuestionPayload,
  UpdateAssessmentStatusPayload,
  UpdateQuestionPayload,
  UpdateQuestionStatusPayload,
  UpsertAnswerPayload,
} from '../types';

/** The flat, top-level question bank (Trainer/Super-Admin only — trainees never call this). */
export const questionsApi = {
  async list(params: QuestionListParams): Promise<PaginatedData<QuestionSummary>> {
    const { data } = await apiClient.get<ApiSuccessResponse<PaginatedData<QuestionSummary>>>('/questions', {
      params,
    });
    return data.data;
  },

  async create(payload: CreateQuestionPayload): Promise<Question> {
    const { data } = await apiClient.post<ApiSuccessResponse<Question>>('/questions', payload);
    return data.data;
  },

  async getById(id: string): Promise<Question> {
    const { data } = await apiClient.get<ApiSuccessResponse<Question>>(`/questions/${id}`);
    return data.data;
  },

  async update(id: string, payload: UpdateQuestionPayload): Promise<Question> {
    const { data } = await apiClient.patch<ApiSuccessResponse<Question>>(`/questions/${id}`, payload);
    return data.data;
  },

  /**
   * NOTE: unlike `update`, this returns the lightweight LIST shape (no `options`) —
   * `questions.repository.ts#update` is called with `listInclude`, not `detailInclude`. Callers
   * that need the full option set after a status change should refetch via `getById`.
   */
  async updateStatus(id: string, payload: UpdateQuestionStatusPayload): Promise<QuestionSummary> {
    const { data } = await apiClient.patch<ApiSuccessResponse<QuestionSummary>>(`/questions/${id}/status`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/questions/${id}`);
  },
};

export const assessmentsApi = {
  async list(params: AssessmentListParams): Promise<PaginatedData<AssessmentSummary>> {
    const { data } = await apiClient.get<ApiSuccessResponse<PaginatedData<AssessmentSummary>>>('/assessments', {
      params,
    });
    return data.data;
  },

  async create(payload: CreateAssessmentPayload): Promise<Assessment> {
    const { data } = await apiClient.post<ApiSuccessResponse<Assessment>>('/assessments', payload);
    return data.data;
  },

  async stats(): Promise<AssessmentStats> {
    const { data } = await apiClient.get<ApiSuccessResponse<AssessmentStats>>('/assessments/stats');
    return data.data;
  },

  async mine(): Promise<MyAssessmentSummary[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<MyAssessmentSummary[]>>('/assessments/mine');
    return data.data;
  },

  async getById(id: string): Promise<AssessmentDetail> {
    const { data } = await apiClient.get<ApiSuccessResponse<AssessmentDetail>>(`/assessments/${id}`);
    return data.data;
  },

  async update(id: string, payload: UpdateAssessmentPayload): Promise<Assessment> {
    const { data } = await apiClient.patch<ApiSuccessResponse<Assessment>>(`/assessments/${id}`, payload);
    return data.data;
  },

  async updateStatus(id: string, payload: UpdateAssessmentStatusPayload): Promise<Assessment> {
    const { data } = await apiClient.patch<ApiSuccessResponse<Assessment>>(`/assessments/${id}/status`, payload);
    return data.data;
  },

  async releaseResults(id: string): Promise<Assessment> {
    const { data } = await apiClient.post<ApiSuccessResponse<Assessment>>(`/assessments/${id}/results/release`);
    return data.data;
  },

  async duplicate(id: string, payload: DuplicateAssessmentPayload): Promise<Assessment> {
    const { data } = await apiClient.post<ApiSuccessResponse<Assessment>>(`/assessments/${id}/duplicate`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/assessments/${id}`);
  },

  async listAssignments(id: string): Promise<AssessmentGroupAssignmentSummary[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<AssessmentGroupAssignmentSummary[]>>(
      `/assessments/${id}/assignments`,
    );
    return data.data;
  },

  async assignGroup(id: string, payload: AssignGroupPayload): Promise<AssessmentGroupAssignment> {
    const { data } = await apiClient.post<ApiSuccessResponse<AssessmentGroupAssignment>>(
      `/assessments/${id}/assignments`,
      payload,
    );
    return data.data;
  },

  async unassignGroup(id: string, groupId: string): Promise<void> {
    await apiClient.delete(`/assessments/${id}/assignments/${groupId}`);
  },

  /** The ordered answer key — trainer-only. */
  async listQuestions(id: string): Promise<AssessmentQuestion[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<AssessmentQuestion[]>>(`/assessments/${id}/questions`);
    return data.data;
  },

  async addQuestion(id: string, payload: AddQuestionPayload): Promise<AssessmentQuestion> {
    const { data } = await apiClient.post<ApiSuccessResponse<AssessmentQuestion>>(
      `/assessments/${id}/questions`,
      payload,
    );
    return data.data;
  },

  async updateQuestion(id: string, aqId: string, payload: UpdateAssessmentQuestionPayload): Promise<AssessmentQuestion> {
    const { data } = await apiClient.patch<ApiSuccessResponse<AssessmentQuestion>>(
      `/assessments/${id}/questions/${aqId}`,
      payload,
    );
    return data.data;
  },

  async removeQuestion(id: string, aqId: string): Promise<void> {
    await apiClient.delete(`/assessments/${id}/questions/${aqId}`);
  },

  /** `orderedIds` must be the full, exact set of this assessment's question ids — enforced server-side. */
  async reorderQuestions(id: string, payload: ReorderQuestionsPayload): Promise<void> {
    await apiClient.patch(`/assessments/${id}/questions/reorder`, payload);
  },
};

/**
 * Nested under `/assessments/:id/attempts` — every method takes `assessmentId` first. RBAC is a
 * hard split at the route level: `start`/`getMine`/`saveAnswer`/`uploadAnswer`/`submit` are
 * Trainee-only; `list`/`getById`/`gradeAnswer` are Trainer/Super-Admin-only.
 */
export const assessmentAttemptsApi = {
  /** Idempotent — resumes the existing IN_PROGRESS attempt if one exists; 409 if already submitted. */
  async start(assessmentId: string): Promise<AttemptStartResponse> {
    const { data } = await apiClient.post<ApiSuccessResponse<AttemptStartResponse>>(
      `/assessments/${assessmentId}/attempts/start`,
    );
    return data.data;
  },

  async getMine(assessmentId: string): Promise<MyAttemptResponse> {
    const { data } = await apiClient.get<ApiSuccessResponse<MyAttemptResponse>>(
      `/assessments/${assessmentId}/attempts/mine`,
    );
    return data.data;
  },

  async saveAnswer(assessmentId: string, assessmentQuestionId: string, payload: UpsertAnswerPayload): Promise<SavedAnswer> {
    const { data } = await apiClient.put<ApiSuccessResponse<SavedAnswer>>(
      `/assessments/${assessmentId}/attempts/mine/answers/${assessmentQuestionId}`,
      payload,
    );
    return data.data;
  },

  /** FILE_UPLOAD questions only — every other type is answered via `saveAnswer`. */
  async uploadAnswer(assessmentId: string, assessmentQuestionId: string, file: File): Promise<SavedAnswer> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post<ApiSuccessResponse<SavedAnswer>>(
      `/assessments/${assessmentId}/attempts/mine/answers/${assessmentQuestionId}/upload`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data.data;
  },

  async submit(assessmentId: string): Promise<Attempt> {
    const { data } = await apiClient.post<ApiSuccessResponse<Attempt>>(
      `/assessments/${assessmentId}/attempts/mine/submit`,
    );
    return data.data;
  },

  async list(assessmentId: string, params: AttemptListParams): Promise<PaginatedData<AttemptSummary>> {
    const { data } = await apiClient.get<ApiSuccessResponse<PaginatedData<AttemptSummary>>>(
      `/assessments/${assessmentId}/attempts`,
      { params },
    );
    return data.data;
  },

  async getById(assessmentId: string, attemptId: string): Promise<AttemptDetail> {
    const { data } = await apiClient.get<ApiSuccessResponse<AttemptDetail>>(
      `/assessments/${assessmentId}/attempts/${attemptId}`,
    );
    return data.data;
  },

  /** Only valid for an answer whose question is a manual-review type (SHORT_ANSWER/LONG_ANSWER/CODE_SNIPPET/FILE_UPLOAD). */
  async gradeAnswer(
    assessmentId: string,
    attemptId: string,
    answerId: string,
    payload: GradeAnswerPayload,
  ): Promise<GradeAnswerResult> {
    const { data } = await apiClient.patch<ApiSuccessResponse<GradeAnswerResult>>(
      `/assessments/${assessmentId}/attempts/${attemptId}/answers/${answerId}/grade`,
      payload,
    );
    return data.data;
  },
};
