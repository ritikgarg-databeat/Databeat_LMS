export * from './video-generations.service';

// API calls for the classroom feature, built on the shared Axios client.
import { apiClient } from '@/services/api/client';
import type { ApiSuccessResponse, PaginatedData } from '@/types/api';

import type {
  AssignGroupPayload,
  ContinueLearningItem,
  Course,
  CourseDetail,
  CourseGroupAssignment,
  CourseGroupAssignmentSummary,
  CourseListParams,
  CourseModule,
  CourseModuleSummary,
  CourseModuleWithLessons,
  CourseProgressBreakdown,
  CourseStats,
  CourseSummary,
  CreateCoursePayload,
  CreateLessonPayload,
  CreateModulePayload,
  CreateTextResourcePayload,
  DuplicateCoursePayload,
  Lesson,
  LessonDetail,
  LessonProgressView,
  LessonQuizResult,
  LessonQuizView,
  LessonResource,
  LessonSummary,
  MyCourseSummary,
  ProgressSummary,
  ReorderLessonsPayload,
  ReorderModulesPayload,
  SubmitLessonQuizPayload,
  UpdateCoursePayload,
  UpdateCourseStatusPayload,
  UpdateLessonPayload,
  UpdateLessonStatusPayload,
  UpdateModulePayload,
  UpdateModuleStatusPayload,
  UploadResourcePayload,
  UpsertLessonProgressPayload,
} from '../types';

export const coursesApi = {
  async list(params: CourseListParams): Promise<PaginatedData<CourseSummary>> {
    const { data } = await apiClient.get<ApiSuccessResponse<PaginatedData<CourseSummary>>>('/courses', { params });
    return data.data;
  },

  async create(payload: CreateCoursePayload): Promise<Course> {
    const { data } = await apiClient.post<ApiSuccessResponse<Course>>('/courses', payload);
    return data.data;
  },

  /** Name kept stable — dashboard wiring depends on it (see `useCourseStatsQuery`). */
  async stats(): Promise<CourseStats> {
    const { data } = await apiClient.get<ApiSuccessResponse<CourseStats>>('/courses/stats');
    return data.data;
  },

  async mine(): Promise<MyCourseSummary[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<MyCourseSummary[]>>('/courses/mine');
    return data.data;
  },

  async getById(id: string): Promise<CourseDetail> {
    const { data } = await apiClient.get<ApiSuccessResponse<CourseDetail>>(`/courses/${id}`);
    return data.data;
  },

  async update(id: string, payload: UpdateCoursePayload): Promise<Course> {
    const { data } = await apiClient.patch<ApiSuccessResponse<Course>>(`/courses/${id}`, payload);
    return data.data;
  },

  async updateStatus(id: string, payload: UpdateCourseStatusPayload): Promise<Course> {
    const { data } = await apiClient.patch<ApiSuccessResponse<Course>>(`/courses/${id}/status`, payload);
    return data.data;
  },

  async duplicate(id: string, payload: DuplicateCoursePayload): Promise<Course> {
    const { data } = await apiClient.post<ApiSuccessResponse<Course>>(`/courses/${id}/duplicate`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/courses/${id}`);
  },

  async listAssignments(id: string): Promise<CourseGroupAssignmentSummary[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<CourseGroupAssignmentSummary[]>>(
      `/courses/${id}/assignments`,
    );
    return data.data;
  },

  async assignGroup(id: string, payload: AssignGroupPayload): Promise<CourseGroupAssignment> {
    const { data } = await apiClient.post<ApiSuccessResponse<CourseGroupAssignment>>(
      `/courses/${id}/assignments`,
      payload,
    );
    return data.data;
  },

  async unassignGroup(id: string, groupId: string): Promise<void> {
    await apiClient.delete(`/courses/${id}/assignments/${groupId}`);
  },
};

export const modulesApi = {
  async list(courseId: string): Promise<CourseModuleSummary[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<CourseModuleSummary[]>>('/modules', {
      params: { courseId },
    });
    return data.data;
  },

  async create(payload: CreateModulePayload): Promise<CourseModule> {
    const { data } = await apiClient.post<ApiSuccessResponse<CourseModule>>('/modules', payload);
    return data.data;
  },

  async getById(id: string): Promise<CourseModuleWithLessons> {
    const { data } = await apiClient.get<ApiSuccessResponse<CourseModuleWithLessons>>(`/modules/${id}`);
    return data.data;
  },

  async update(id: string, payload: UpdateModulePayload): Promise<CourseModule> {
    const { data } = await apiClient.patch<ApiSuccessResponse<CourseModule>>(`/modules/${id}`, payload);
    return data.data;
  },

  async updateStatus(id: string, payload: UpdateModuleStatusPayload): Promise<CourseModule> {
    const { data } = await apiClient.patch<ApiSuccessResponse<CourseModule>>(`/modules/${id}/status`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/modules/${id}`);
  },

  async reorder(payload: ReorderModulesPayload): Promise<void> {
    await apiClient.patch('/modules/reorder', payload);
  },
};

export const lessonsApi = {
  async list(moduleId: string): Promise<LessonSummary[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<LessonSummary[]>>('/lessons', { params: { moduleId } });
    return data.data;
  },

  async create(payload: CreateLessonPayload): Promise<Lesson> {
    const { data } = await apiClient.post<ApiSuccessResponse<Lesson>>('/lessons', payload);
    return data.data;
  },

  async getById(id: string): Promise<LessonDetail> {
    const { data } = await apiClient.get<ApiSuccessResponse<LessonDetail>>(`/lessons/${id}`);
    return data.data;
  },

  async update(id: string, payload: UpdateLessonPayload): Promise<Lesson> {
    const { data } = await apiClient.patch<ApiSuccessResponse<Lesson>>(`/lessons/${id}`, payload);
    return data.data;
  },

  async updateStatus(id: string, payload: UpdateLessonStatusPayload): Promise<Lesson> {
    const { data } = await apiClient.patch<ApiSuccessResponse<Lesson>>(`/lessons/${id}/status`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/lessons/${id}`);
  },

  async reorder(payload: ReorderLessonsPayload): Promise<void> {
    await apiClient.patch('/lessons/reorder', payload);
  },
};

export const resourcesApi = {
  async list(lessonId: string): Promise<LessonResource[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<LessonResource[]>>(`/lessons/${lessonId}/resources`);
    return data.data;
  },

  async upload(lessonId: string, payload: UploadResourcePayload): Promise<LessonResource> {
    const formData = new FormData();
    formData.append('title', payload.title);
    formData.append('type', payload.type);
    formData.append('file', payload.file);
    const { data } = await apiClient.post<ApiSuccessResponse<LessonResource>>(
      `/lessons/${lessonId}/resources/upload`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data.data;
  },

  async createText(lessonId: string, payload: CreateTextResourcePayload): Promise<LessonResource> {
    const { data } = await apiClient.post<ApiSuccessResponse<LessonResource>>(
      `/lessons/${lessonId}/resources/text`,
      payload,
    );
    return data.data;
  },

  async remove(lessonId: string, resourceId: string): Promise<void> {
    await apiClient.delete(`/lessons/${lessonId}/resources/${resourceId}`);
  },

  /**
   * Streams the raw file — NOT the `{success,message,data}` envelope every other endpoint
   * returns — so the response is read as a `Blob` and handed back as-is. The endpoint requires
   * the `Authorization` header (attached automatically by `apiClient`'s interceptor), which is
   * exactly why callers can't just point an `<a href>`/`<img src>` at it directly; see
   * `useDownloadResource` and `useAuthenticatedMediaUrl` in ../hooks.
   */
  async download(lessonId: string, resourceId: string): Promise<Blob> {
    const { data } = await apiClient.get<Blob>(`/lessons/${lessonId}/resources/${resourceId}/download`, {
      responseType: 'blob',
    });
    return data;
  },
};

/**
 * Lesson-scoped progress endpoints are physically routed under `/lessons/:id/progress` (see
 * backend README.md), but they're grouped here with the rest of the progress domain rather than
 * on `lessonsApi`, mirroring the backend's own `ProgressController.getForLesson`/`upsertForLesson`
 * naming.
 */
export const progressApi = {
  async getForLesson(lessonId: string): Promise<LessonProgressView> {
    const { data } = await apiClient.get<ApiSuccessResponse<LessonProgressView>>(`/lessons/${lessonId}/progress`);
    return data.data;
  },

  async upsertForLesson(lessonId: string, payload: UpsertLessonProgressPayload): Promise<LessonProgressView> {
    const { data } = await apiClient.post<ApiSuccessResponse<LessonProgressView>>(
      `/lessons/${lessonId}/progress`,
      payload,
    );
    return data.data;
  },

  async continueLearning(limit?: number): Promise<ContinueLearningItem[]> {
    const { data } = await apiClient.get<ApiSuccessResponse<ContinueLearningItem[]>>('/progress/continue-learning', {
      params: limit ? { limit } : undefined,
    });
    return data.data;
  },

  async summary(): Promise<ProgressSummary> {
    const { data } = await apiClient.get<ApiSuccessResponse<ProgressSummary>>('/progress/summary');
    return data.data;
  },

  async courseProgress(courseId: string): Promise<CourseProgressBreakdown> {
    const { data } = await apiClient.get<ApiSuccessResponse<CourseProgressBreakdown>>(
      `/progress/courses/${courseId}`,
    );
    return data.data;
  },
};

/**
 * Modeled as mutations on the frontend (see `useLessonQuizMutation`/`useSubmitLessonQuizMutation`
 * in ../hooks) even though `getOrGenerate` is semantically a GET — fetching it can trigger a
 * real, billed AI call, so it must only ever fire on an explicit "Mark as complete" click, never
 * automatically on mount the way a `useQuery` would.
 */
export const lessonQuizApi = {
  async getOrGenerate(lessonId: string): Promise<LessonQuizView> {
    const { data } = await apiClient.get<ApiSuccessResponse<LessonQuizView>>(`/lessons/${lessonId}/quiz`);
    return data.data;
  },

  async submit(lessonId: string, payload: SubmitLessonQuizPayload): Promise<LessonQuizResult> {
    const { data } = await apiClient.post<ApiSuccessResponse<LessonQuizResult>>(
      `/lessons/${lessonId}/quiz/submit`,
      payload,
    );
    return data.data;
  },
};
