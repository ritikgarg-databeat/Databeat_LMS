// React hooks (including TanStack Query hooks) for the classroom feature.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { coursesApi, lessonQuizApi, lessonsApi, modulesApi, progressApi, resourcesApi } from '../services';
import type {
  AssignGroupPayload,
  CourseListParams,
  CreateCoursePayload,
  CreateLessonPayload,
  CreateModulePayload,
  CreateTextResourcePayload,
  DuplicateCoursePayload,
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

export * from './use-authenticated-media-url';

const COURSES_LIST_QUERY_KEY = 'classroom-courses-list';
const COURSE_QUERY_KEY = 'classroom-course';
const COURSE_STATS_QUERY_KEY = 'classroom-course-stats';
const MY_COURSES_QUERY_KEY = 'classroom-my-courses';
const COURSE_ASSIGNMENTS_QUERY_KEY = 'classroom-course-assignments';
const MODULES_LIST_QUERY_KEY = 'classroom-modules-list';
const MODULE_QUERY_KEY = 'classroom-module';
const LESSONS_LIST_QUERY_KEY = 'classroom-lessons-list';
const LESSON_QUERY_KEY = 'classroom-lesson';
const LESSON_RESOURCES_QUERY_KEY = 'classroom-lesson-resources';
const LESSON_PROGRESS_QUERY_KEY = 'classroom-lesson-progress';
const CONTINUE_LEARNING_QUERY_KEY = 'classroom-continue-learning';
const PROGRESS_SUMMARY_QUERY_KEY = 'classroom-progress-summary';
const COURSE_PROGRESS_QUERY_KEY = 'classroom-course-progress';

/* -------------------------------------------------------------------------- */
/* Queries                                                                     */
/* -------------------------------------------------------------------------- */

export function useCoursesQuery(params: CourseListParams) {
  return useQuery({
    queryKey: [COURSES_LIST_QUERY_KEY, params],
    queryFn: () => coursesApi.list(params),
    placeholderData: (previous) => previous,
  });
}

export function useCourseQuery(id: string | undefined) {
  return useQuery({
    queryKey: [COURSE_QUERY_KEY, id],
    queryFn: () => coursesApi.getById(id as string),
    enabled: Boolean(id),
  });
}

/** Name kept exactly stable — the dashboard wiring depends on it (mirrors `useGroupStatsQuery`). */
export function useCourseStatsQuery() {
  return useQuery({ queryKey: [COURSE_STATS_QUERY_KEY], queryFn: coursesApi.stats });
}

export function useMyCoursesQuery() {
  return useQuery({ queryKey: [MY_COURSES_QUERY_KEY], queryFn: coursesApi.mine });
}

export function useCourseAssignmentsQuery(courseId: string | undefined) {
  return useQuery({
    queryKey: [COURSE_ASSIGNMENTS_QUERY_KEY, courseId],
    queryFn: () => coursesApi.listAssignments(courseId as string),
    enabled: Boolean(courseId),
  });
}

export function useModulesQuery(courseId: string | undefined) {
  return useQuery({
    queryKey: [MODULES_LIST_QUERY_KEY, courseId],
    queryFn: () => modulesApi.list(courseId as string),
    enabled: Boolean(courseId),
  });
}

export function useModuleQuery(id: string | undefined) {
  return useQuery({
    queryKey: [MODULE_QUERY_KEY, id],
    queryFn: () => modulesApi.getById(id as string),
    enabled: Boolean(id),
  });
}

export function useLessonsQuery(moduleId: string | undefined) {
  return useQuery({
    queryKey: [LESSONS_LIST_QUERY_KEY, moduleId],
    queryFn: () => lessonsApi.list(moduleId as string),
    enabled: Boolean(moduleId),
  });
}

export function useLessonQuery(id: string | undefined) {
  return useQuery({
    queryKey: [LESSON_QUERY_KEY, id],
    queryFn: () => lessonsApi.getById(id as string),
    enabled: Boolean(id),
  });
}

export function useLessonResourcesQuery(lessonId: string | undefined) {
  return useQuery({
    queryKey: [LESSON_RESOURCES_QUERY_KEY, lessonId],
    queryFn: () => resourcesApi.list(lessonId as string),
    enabled: Boolean(lessonId),
  });
}

export function useLessonProgressQuery(lessonId: string | undefined) {
  return useQuery({
    queryKey: [LESSON_PROGRESS_QUERY_KEY, lessonId],
    queryFn: () => progressApi.getForLesson(lessonId as string),
    enabled: Boolean(lessonId),
  });
}

export function useContinueLearningQuery(limit?: number) {
  return useQuery({
    queryKey: [CONTINUE_LEARNING_QUERY_KEY, limit],
    queryFn: () => progressApi.continueLearning(limit),
  });
}

export function useProgressSummaryQuery() {
  return useQuery({ queryKey: [PROGRESS_SUMMARY_QUERY_KEY], queryFn: progressApi.summary });
}

export function useCourseProgressQuery(courseId: string | undefined) {
  return useQuery({
    queryKey: [COURSE_PROGRESS_QUERY_KEY, courseId],
    queryFn: () => progressApi.courseProgress(courseId as string),
    enabled: Boolean(courseId),
  });
}

/* -------------------------------------------------------------------------- */
/* Invalidation helpers                                                        */
/* -------------------------------------------------------------------------- */

function useInvalidateCoursesList() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [COURSES_LIST_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: [COURSE_STATS_QUERY_KEY] });
  };
}

function useInvalidateCourse() {
  const queryClient = useQueryClient();
  return (id: string) => void queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY, id] });
}

/**
 * Every trainee-facing surface that depends on which courses/lessons are currently
 * published + group-assigned (i.e. "accessible"). Invalidated whenever a mutation could have
 * changed that accessibility: a course/module/lesson publish toggle, or a group
 * assignment/unassignment.
 */
function useInvalidateTraineeAccessibleSurfaces() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [MY_COURSES_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: [PROGRESS_SUMMARY_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: [CONTINUE_LEARNING_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: [COURSE_PROGRESS_QUERY_KEY] });
  };
}

/**
 * `courseId` is optional because not every mutation response carries it (see the lesson
 * mutations below) — omitting it invalidates the whole list-query family (every courseId),
 * which is the safe fallback, exactly like `useInvalidateGroupsList` invalidates every params
 * combination rather than one specific page.
 */
function useInvalidateModulesList() {
  const queryClient = useQueryClient();
  return (courseId?: string) =>
    void queryClient.invalidateQueries({
      queryKey: courseId ? [MODULES_LIST_QUERY_KEY, courseId] : [MODULES_LIST_QUERY_KEY],
    });
}

function useInvalidateModule() {
  const queryClient = useQueryClient();
  return (id: string) => void queryClient.invalidateQueries({ queryKey: [MODULE_QUERY_KEY, id] });
}

function useInvalidateLessonsList() {
  const queryClient = useQueryClient();
  return (moduleId?: string) =>
    void queryClient.invalidateQueries({
      queryKey: moduleId ? [LESSONS_LIST_QUERY_KEY, moduleId] : [LESSONS_LIST_QUERY_KEY],
    });
}

function useInvalidateLesson() {
  const queryClient = useQueryClient();
  return (id: string) => void queryClient.invalidateQueries({ queryKey: [LESSON_QUERY_KEY, id] });
}

/**
 * A lesson mutation only ever knows its own `moduleId`, never the grandparent `courseId` — but
 * a lesson being added/changed/removed/(un)published also invalidates: the parent module's
 * `_count.lessons`-bearing list, the course list's `lessonCount`/`moduleCount`, and the course
 * detail's nested `modules[].lessons`. Since none of those are addressable by courseId here,
 * they're invalidated broadly (every courseId) rather than narrowly — cheap, since only
 * currently-mounted queries actually refetch.
 */
function useInvalidateCourseAggregatesAfterLessonChange() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [MODULES_LIST_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: [COURSES_LIST_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY] });
  };
}

function useInvalidateLessonResources() {
  const queryClient = useQueryClient();
  return (lessonId: string) =>
    void queryClient.invalidateQueries({ queryKey: [LESSON_RESOURCES_QUERY_KEY, lessonId] });
}

/* -------------------------------------------------------------------------- */
/* Course mutations                                                            */
/* -------------------------------------------------------------------------- */

export function useCreateCourseMutation() {
  const invalidateList = useInvalidateCoursesList();
  return useMutation({
    mutationFn: (payload: CreateCoursePayload) => coursesApi.create(payload),
    onSuccess: invalidateList,
  });
}

export function useUpdateCourseMutation() {
  const invalidateList = useInvalidateCoursesList();
  const invalidateCourse = useInvalidateCourse();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCoursePayload }) => coursesApi.update(id, payload),
    onSuccess: (_data, variables) => {
      invalidateList();
      invalidateCourse(variables.id);
    },
  });
}

/** Publishing/archiving a course changes what trainees can see — invalidate their surfaces too. */
export function useUpdateCourseStatusMutation() {
  const invalidateList = useInvalidateCoursesList();
  const invalidateCourse = useInvalidateCourse();
  const invalidateTraineeSurfaces = useInvalidateTraineeAccessibleSurfaces();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCourseStatusPayload }) =>
      coursesApi.updateStatus(id, payload),
    onSuccess: (_data, variables) => {
      invalidateList();
      invalidateCourse(variables.id);
      invalidateTraineeSurfaces();
    },
  });
}

export function useDuplicateCourseMutation() {
  const invalidateList = useInvalidateCoursesList();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DuplicateCoursePayload }) =>
      coursesApi.duplicate(id, payload),
    onSuccess: invalidateList,
  });
}

/** Soft-deleting a course also removes it from any trainee's assigned-courses view. */
export function useDeleteCourseMutation() {
  const invalidateList = useInvalidateCoursesList();
  const invalidateTraineeSurfaces = useInvalidateTraineeAccessibleSurfaces();
  return useMutation({
    mutationFn: (id: string) => coursesApi.remove(id),
    onSuccess: () => {
      invalidateList();
      invalidateTraineeSurfaces();
    },
  });
}

function useInvalidateCourseAssignments() {
  const queryClient = useQueryClient();
  const invalidateList = useInvalidateCoursesList();
  const invalidateCourse = useInvalidateCourse();
  const invalidateTraineeSurfaces = useInvalidateTraineeAccessibleSurfaces();
  return (courseId: string) => {
    void queryClient.invalidateQueries({ queryKey: [COURSE_ASSIGNMENTS_QUERY_KEY, courseId] });
    invalidateCourse(courseId);
    invalidateList();
    invalidateTraineeSurfaces();
  };
}

export function useAssignGroupMutation() {
  const invalidate = useInvalidateCourseAssignments();
  return useMutation({
    mutationFn: ({ courseId, payload }: { courseId: string; payload: AssignGroupPayload }) =>
      coursesApi.assignGroup(courseId, payload),
    onSuccess: (_data, variables) => invalidate(variables.courseId),
  });
}

export function useUnassignGroupMutation() {
  const invalidate = useInvalidateCourseAssignments();
  return useMutation({
    mutationFn: ({ courseId, groupId }: { courseId: string; groupId: string }) =>
      coursesApi.unassignGroup(courseId, groupId),
    onSuccess: (_data, variables) => invalidate(variables.courseId),
  });
}

/* -------------------------------------------------------------------------- */
/* Module mutations                                                            */
/* -------------------------------------------------------------------------- */

export function useCreateModuleMutation() {
  const invalidateModulesList = useInvalidateModulesList();
  const invalidateCourse = useInvalidateCourse();
  const invalidateCoursesList = useInvalidateCoursesList();
  return useMutation({
    mutationFn: (payload: CreateModulePayload) => modulesApi.create(payload),
    onSuccess: (data) => {
      invalidateModulesList(data.courseId);
      invalidateCourse(data.courseId);
      invalidateCoursesList();
    },
  });
}

export function useUpdateModuleMutation() {
  const invalidateModulesList = useInvalidateModulesList();
  const invalidateModule = useInvalidateModule();
  const invalidateCourse = useInvalidateCourse();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateModulePayload }) => modulesApi.update(id, payload),
    onSuccess: (data) => {
      invalidateModulesList(data.courseId);
      invalidateModule(data.id);
      invalidateCourse(data.courseId);
    },
  });
}

/** Publishing/unpublishing a module changes which of its lessons trainees can reach. */
export function useUpdateModuleStatusMutation() {
  const invalidateModulesList = useInvalidateModulesList();
  const invalidateModule = useInvalidateModule();
  const invalidateCourse = useInvalidateCourse();
  const invalidateCoursesList = useInvalidateCoursesList();
  const invalidateTraineeSurfaces = useInvalidateTraineeAccessibleSurfaces();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateModuleStatusPayload }) =>
      modulesApi.updateStatus(id, payload),
    onSuccess: (data) => {
      invalidateModulesList(data.courseId);
      invalidateModule(data.id);
      invalidateCourse(data.courseId);
      invalidateCoursesList();
      invalidateTraineeSurfaces();
    },
  });
}

export function useDeleteModuleMutation() {
  const invalidateModulesList = useInvalidateModulesList();
  const invalidateCourse = useInvalidateCourse();
  const invalidateCoursesList = useInvalidateCoursesList();
  return useMutation({
    mutationFn: ({ id }: { id: string; courseId: string }) => modulesApi.remove(id),
    onSuccess: (_data, variables) => {
      invalidateModulesList(variables.courseId);
      invalidateCourse(variables.courseId);
      invalidateCoursesList();
    },
  });
}

export function useReorderModulesMutation() {
  const invalidateModulesList = useInvalidateModulesList();
  const invalidateCourse = useInvalidateCourse();
  return useMutation({
    mutationFn: (payload: ReorderModulesPayload) => modulesApi.reorder(payload),
    onSuccess: (_data, variables) => {
      invalidateModulesList(variables.courseId);
      invalidateCourse(variables.courseId);
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Lesson mutations                                                            */
/* -------------------------------------------------------------------------- */

export function useCreateLessonMutation() {
  const invalidateLessonsList = useInvalidateLessonsList();
  const invalidateCourseAggregates = useInvalidateCourseAggregatesAfterLessonChange();
  return useMutation({
    mutationFn: (payload: CreateLessonPayload) => lessonsApi.create(payload),
    onSuccess: (data) => {
      invalidateLessonsList(data.moduleId);
      invalidateCourseAggregates();
    },
  });
}

export function useUpdateLessonMutation() {
  const invalidateLessonsList = useInvalidateLessonsList();
  const invalidateLesson = useInvalidateLesson();
  const invalidateCourseAggregates = useInvalidateCourseAggregatesAfterLessonChange();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateLessonPayload }) => lessonsApi.update(id, payload),
    onSuccess: (data) => {
      invalidateLessonsList(data.moduleId);
      invalidateLesson(data.id);
      invalidateCourseAggregates();
    },
  });
}

/** Publishing/unpublishing a lesson directly changes trainee accessibility. */
export function useUpdateLessonStatusMutation() {
  const invalidateLessonsList = useInvalidateLessonsList();
  const invalidateLesson = useInvalidateLesson();
  const invalidateCourseAggregates = useInvalidateCourseAggregatesAfterLessonChange();
  const invalidateTraineeSurfaces = useInvalidateTraineeAccessibleSurfaces();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateLessonStatusPayload }) =>
      lessonsApi.updateStatus(id, payload),
    onSuccess: (data) => {
      invalidateLessonsList(data.moduleId);
      invalidateLesson(data.id);
      invalidateCourseAggregates();
      invalidateTraineeSurfaces();
    },
  });
}

export function useDeleteLessonMutation() {
  const invalidateLessonsList = useInvalidateLessonsList();
  const invalidateCourseAggregates = useInvalidateCourseAggregatesAfterLessonChange();
  return useMutation({
    mutationFn: ({ id }: { id: string; moduleId: string }) => lessonsApi.remove(id),
    onSuccess: (_data, variables) => {
      invalidateLessonsList(variables.moduleId);
      invalidateCourseAggregates();
    },
  });
}

export function useReorderLessonsMutation() {
  const invalidateLessonsList = useInvalidateLessonsList();
  const invalidateCourseAggregates = useInvalidateCourseAggregatesAfterLessonChange();
  return useMutation({
    mutationFn: (payload: ReorderLessonsPayload) => lessonsApi.reorder(payload),
    onSuccess: (_data, variables) => {
      invalidateLessonsList(variables.moduleId);
      // `ModuleLessonTree` renders lessons from `useCourseQuery`'s embedded `modules[].lessons`,
      // not from `useLessonsQuery` — without this, a reordered lesson list in the course editor
      // snaps back to its old order and never corrects itself (unlike modules, which already
      // invalidate the course query here).
      invalidateCourseAggregates();
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Resource mutations                                                         */
/* -------------------------------------------------------------------------- */

export function useUploadResourceMutation() {
  const invalidateResources = useInvalidateLessonResources();
  const invalidateLesson = useInvalidateLesson();
  return useMutation({
    mutationFn: ({ lessonId, payload }: { lessonId: string; payload: UploadResourcePayload }) =>
      resourcesApi.upload(lessonId, payload),
    onSuccess: (_data, variables) => {
      invalidateResources(variables.lessonId);
      invalidateLesson(variables.lessonId);
    },
  });
}

export function useCreateTextResourceMutation() {
  const invalidateResources = useInvalidateLessonResources();
  const invalidateLesson = useInvalidateLesson();
  return useMutation({
    mutationFn: ({ lessonId, payload }: { lessonId: string; payload: CreateTextResourcePayload }) =>
      resourcesApi.createText(lessonId, payload),
    onSuccess: (_data, variables) => {
      invalidateResources(variables.lessonId);
      invalidateLesson(variables.lessonId);
    },
  });
}

export function useRemoveResourceMutation() {
  const invalidateResources = useInvalidateLessonResources();
  const invalidateLesson = useInvalidateLesson();
  return useMutation({
    mutationFn: ({ lessonId, resourceId }: { lessonId: string; resourceId: string }) =>
      resourcesApi.remove(lessonId, resourceId),
    onSuccess: (_data, variables) => {
      invalidateResources(variables.lessonId);
      invalidateLesson(variables.lessonId);
    },
  });
}

/**
 * Downloads are triggered imperatively (a click), not rendered reactively — so this is a plain
 * async helper, not a `useQuery`. For INLINE preview instead, see `useAuthenticatedMediaUrl`.
 */
export function useDownloadResource() {
  return useCallback(async (lessonId: string, resourceId: string, filename: string): Promise<void> => {
    const blob = await resourcesApi.download(lessonId, resourceId);
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      URL.revokeObjectURL(url);
    }
  }, []);
}

/* -------------------------------------------------------------------------- */
/* Progress mutations                                                          */
/* -------------------------------------------------------------------------- */

export function useUpsertLessonProgressMutation() {
  const queryClient = useQueryClient();
  const invalidateLesson = useInvalidateLesson();
  const invalidateTraineeSurfaces = useInvalidateTraineeAccessibleSurfaces();
  return useMutation({
    mutationFn: ({ lessonId, payload }: { lessonId: string; payload: UpsertLessonProgressPayload }) =>
      progressApi.upsertForLesson(lessonId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: [LESSON_PROGRESS_QUERY_KEY, variables.lessonId] });
      // `LessonDetail.progress` is embedded inline, so the lesson detail query is stale too.
      invalidateLesson(variables.lessonId);
      invalidateTraineeSurfaces();
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Lesson completion quiz                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A mutation, not a `useQuery` — fetching can trigger a real, billed AI call on the first
 * request for a given (lesson, trainee), so this must only ever fire from an explicit "Mark as
 * complete" click, never automatically on mount.
 */
export function useLessonQuizMutation() {
  return useMutation({
    mutationFn: (lessonId: string) => lessonQuizApi.getOrGenerate(lessonId),
  });
}

export function useSubmitLessonQuizMutation() {
  return useMutation({
    mutationFn: ({ lessonId, payload }: { lessonId: string; payload: SubmitLessonQuizPayload }) =>
      lessonQuizApi.submit(lessonId, payload),
  });
}
