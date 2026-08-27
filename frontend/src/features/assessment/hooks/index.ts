// React hooks (including TanStack Query hooks) for the assessment feature.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { assessmentAttemptsApi, assessmentsApi, questionsApi } from '../services';
import type {
  AddQuestionPayload,
  AssignGroupPayload,
  AttemptListParams,
  AssessmentIntegrityEventType,
  CreateAssessmentPayload,
  CreateQuestionPayload,
  DuplicateAssessmentPayload,
  GradeAnswerPayload,
  QuestionListParams,
  AssessmentListParams,
  ReorderQuestionsPayload,
  UpdateAssessmentPayload,
  UpdateAssessmentQuestionPayload,
  UpdateAssessmentStatusPayload,
  UpdateQuestionPayload,
  UpdateQuestionStatusPayload,
  UpsertAnswerPayload,
} from '../types';

const QUESTIONS_LIST_QUERY_KEY = 'questions-list';
const QUESTION_QUERY_KEY = 'question';
const ASSESSMENTS_LIST_QUERY_KEY = 'assessments-list';
const ASSESSMENT_QUERY_KEY = 'assessment';
const ASSESSMENT_STATS_QUERY_KEY = 'assessment-stats';
const MY_ASSESSMENTS_QUERY_KEY = 'my-assessments';
const ASSESSMENT_ASSIGNMENTS_QUERY_KEY = 'assessment-assignments';
/** The per-assessment ordered answer key (`AssessmentQuestion[]`) — distinct from `QUESTIONS_LIST_QUERY_KEY` (the bank). */
const ASSESSMENT_QUESTIONS_QUERY_KEY = 'assessment-questions';
const ATTEMPT_MINE_QUERY_KEY = 'attempt-mine';
const ATTEMPTS_LIST_QUERY_KEY = 'attempts-list';
const ATTEMPT_DETAIL_QUERY_KEY = 'attempt-detail';

/* -------------------------------------------------------------------------- */
/* Question bank queries                                                      */
/* -------------------------------------------------------------------------- */

export function useQuestionsQuery(params: QuestionListParams) {
  return useQuery({
    queryKey: [QUESTIONS_LIST_QUERY_KEY, params],
    queryFn: () => questionsApi.list(params),
    placeholderData: (previous) => previous,
  });
}

export function useQuestionQuery(id: string | undefined) {
  return useQuery({
    queryKey: [QUESTION_QUERY_KEY, id],
    queryFn: () => questionsApi.getById(id as string),
    enabled: Boolean(id),
  });
}

/* -------------------------------------------------------------------------- */
/* Assessment queries                                                         */
/* -------------------------------------------------------------------------- */

export function useAssessmentsQuery(params: AssessmentListParams) {
  return useQuery({
    queryKey: [ASSESSMENTS_LIST_QUERY_KEY, params],
    queryFn: () => assessmentsApi.list(params),
    placeholderData: (previous) => previous,
  });
}

export function useAssessmentQuery(id: string | undefined) {
  return useQuery({
    queryKey: [ASSESSMENT_QUERY_KEY, id],
    queryFn: () => assessmentsApi.getById(id as string),
    enabled: Boolean(id),
  });
}

export function useAssessmentStatsQuery() {
  return useQuery({ queryKey: [ASSESSMENT_STATS_QUERY_KEY], queryFn: assessmentsApi.stats });
}

export function useMyAssessmentsQuery() {
  return useQuery({ queryKey: [MY_ASSESSMENTS_QUERY_KEY], queryFn: assessmentsApi.mine });
}

export function useAssessmentAssignmentsQuery(assessmentId: string | undefined) {
  return useQuery({
    queryKey: [ASSESSMENT_ASSIGNMENTS_QUERY_KEY, assessmentId],
    queryFn: () => assessmentsApi.listAssignments(assessmentId as string),
    enabled: Boolean(assessmentId),
  });
}

/** The trainer-only answer key list for one assessment. */
export function useAssessmentQuestionsQuery(assessmentId: string | undefined) {
  return useQuery({
    queryKey: [ASSESSMENT_QUESTIONS_QUERY_KEY, assessmentId],
    queryFn: () => assessmentsApi.listQuestions(assessmentId as string),
    enabled: Boolean(assessmentId),
  });
}

/* -------------------------------------------------------------------------- */
/* Attempt queries                                                            */
/* -------------------------------------------------------------------------- */

export function useAttemptMineQuery(assessmentId: string | undefined) {
  return useQuery({
    queryKey: [ATTEMPT_MINE_QUERY_KEY, assessmentId],
    queryFn: () => assessmentAttemptsApi.getMine(assessmentId as string),
    enabled: Boolean(assessmentId),
  });
}

export function useAttemptsQuery(assessmentId: string | undefined, params: AttemptListParams) {
  return useQuery({
    queryKey: [ATTEMPTS_LIST_QUERY_KEY, assessmentId, params],
    queryFn: () => assessmentAttemptsApi.list(assessmentId as string, params),
    enabled: Boolean(assessmentId),
    placeholderData: (previous) => previous,
  });
}

export function useAttemptDetailQuery(assessmentId: string | undefined, attemptId: string | undefined) {
  return useQuery({
    queryKey: [ATTEMPT_DETAIL_QUERY_KEY, assessmentId, attemptId],
    queryFn: () => assessmentAttemptsApi.getById(assessmentId as string, attemptId as string),
    enabled: Boolean(assessmentId) && Boolean(attemptId),
  });
}

/* -------------------------------------------------------------------------- */
/* Invalidation helpers                                                       */
/* -------------------------------------------------------------------------- */

function useInvalidateQuestionsList() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: [QUESTIONS_LIST_QUERY_KEY] });
}

function useInvalidateQuestion() {
  const queryClient = useQueryClient();
  return (id: string) => void queryClient.invalidateQueries({ queryKey: [QUESTION_QUERY_KEY, id] });
}

function useInvalidateAssessmentsList() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [ASSESSMENTS_LIST_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: [ASSESSMENT_STATS_QUERY_KEY] });
  };
}

function useInvalidateAssessment() {
  const queryClient = useQueryClient();
  return (id: string) => void queryClient.invalidateQueries({ queryKey: [ASSESSMENT_QUERY_KEY, id] });
}

/** The trainee-facing "which assessments/attempts can I see" surface — currently just `/assessments/mine`. */
function useInvalidateTraineeAssessmentSurfaces() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: [MY_ASSESSMENTS_QUERY_KEY] });
}

/**
 * Adding/removing/re-weighting/reordering a question on an assessment changes that assessment's
 * answer-key list, its own `questionCount`/`maxMarks` (detail view), the assessments list's
 * counts, and (if already published) what a trainee sees on `/assessments/mine`.
 */
function useInvalidateAssessmentQuestions() {
  const queryClient = useQueryClient();
  const invalidateAssessment = useInvalidateAssessment();
  const invalidateAssessmentsList = useInvalidateAssessmentsList();
  const invalidateTraineeSurfaces = useInvalidateTraineeAssessmentSurfaces();
  return (assessmentId: string) => {
    void queryClient.invalidateQueries({ queryKey: [ASSESSMENT_QUESTIONS_QUERY_KEY, assessmentId] });
    invalidateAssessment(assessmentId);
    invalidateAssessmentsList();
    invalidateTraineeSurfaces();
  };
}

/**
 * Assigning/unassigning a group changes the assignments list, the assessment detail's
 * `assignedGroups`, the assessments list's `_count.groupAssignments`, and trainee accessibility.
 */
function useInvalidateAssessmentAssignments() {
  const queryClient = useQueryClient();
  const invalidateAssessment = useInvalidateAssessment();
  const invalidateAssessmentsList = useInvalidateAssessmentsList();
  const invalidateTraineeSurfaces = useInvalidateTraineeAssessmentSurfaces();
  return (assessmentId: string) => {
    void queryClient.invalidateQueries({ queryKey: [ASSESSMENT_ASSIGNMENTS_QUERY_KEY, assessmentId] });
    invalidateAssessment(assessmentId);
    invalidateAssessmentsList();
    invalidateTraineeSurfaces();
  };
}

function useInvalidateAttemptMine() {
  const queryClient = useQueryClient();
  return (assessmentId: string) =>
    void queryClient.invalidateQueries({ queryKey: [ATTEMPT_MINE_QUERY_KEY, assessmentId] });
}

function useInvalidateAttemptsList() {
  const queryClient = useQueryClient();
  return (assessmentId: string) =>
    void queryClient.invalidateQueries({ queryKey: [ATTEMPTS_LIST_QUERY_KEY, assessmentId] });
}

function useInvalidateAttemptDetail() {
  const queryClient = useQueryClient();
  return (assessmentId: string, attemptId: string) =>
    void queryClient.invalidateQueries({ queryKey: [ATTEMPT_DETAIL_QUERY_KEY, assessmentId, attemptId] });
}

/* -------------------------------------------------------------------------- */
/* Question bank mutations                                                    */
/* -------------------------------------------------------------------------- */

export function useCreateQuestionMutation() {
  const invalidateList = useInvalidateQuestionsList();
  return useMutation({
    mutationFn: (payload: CreateQuestionPayload) => questionsApi.create(payload),
    onSuccess: invalidateList,
  });
}

export function useUpdateQuestionMutation() {
  const invalidateList = useInvalidateQuestionsList();
  const invalidateQuestion = useInvalidateQuestion();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateQuestionPayload }) =>
      questionsApi.update(id, payload),
    onSuccess: (_data, variables) => {
      invalidateList();
      invalidateQuestion(variables.id);
    },
  });
}

export function useUpdateQuestionStatusMutation() {
  const invalidateList = useInvalidateQuestionsList();
  const invalidateQuestion = useInvalidateQuestion();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateQuestionStatusPayload }) =>
      questionsApi.updateStatus(id, payload),
    onSuccess: (_data, variables) => {
      invalidateList();
      invalidateQuestion(variables.id);
    },
  });
}

export function useDeleteQuestionMutation() {
  const invalidateList = useInvalidateQuestionsList();
  const invalidateQuestion = useInvalidateQuestion();
  return useMutation({
    mutationFn: (id: string) => questionsApi.remove(id),
    onSuccess: (_data, id) => {
      invalidateList();
      invalidateQuestion(id);
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Assessment mutations                                                       */
/* -------------------------------------------------------------------------- */

export function useCreateAssessmentMutation() {
  const invalidateList = useInvalidateAssessmentsList();
  return useMutation({
    mutationFn: (payload: CreateAssessmentPayload) => assessmentsApi.create(payload),
    onSuccess: invalidateList,
  });
}

export function useUpdateAssessmentMutation() {
  const invalidateList = useInvalidateAssessmentsList();
  const invalidateAssessment = useInvalidateAssessment();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAssessmentPayload }) =>
      assessmentsApi.update(id, payload),
    onSuccess: (_data, variables) => {
      invalidateList();
      invalidateAssessment(variables.id);
    },
  });
}

/** Publishing/archiving an assessment changes what trainees can see — invalidate their surfaces too. */
export function useUpdateAssessmentStatusMutation() {
  const invalidateList = useInvalidateAssessmentsList();
  const invalidateAssessment = useInvalidateAssessment();
  const invalidateTraineeSurfaces = useInvalidateTraineeAssessmentSurfaces();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAssessmentStatusPayload }) =>
      assessmentsApi.updateStatus(id, payload),
    onSuccess: (_data, variables) => {
      invalidateList();
      invalidateAssessment(variables.id);
      invalidateTraineeSurfaces();
    },
  });
}

export function useReleaseAssessmentResultsMutation() {
  const invalidateAssessment = useInvalidateAssessment();
  const invalidateTraineeSurfaces = useInvalidateTraineeAssessmentSurfaces();
  return useMutation({
    mutationFn: (id: string) => assessmentsApi.releaseResults(id),
    onSuccess: (_data, id) => {
      invalidateAssessment(id);
      invalidateTraineeSurfaces();
    },
  });
}

export function useDuplicateAssessmentMutation() {
  const invalidateList = useInvalidateAssessmentsList();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DuplicateAssessmentPayload }) =>
      assessmentsApi.duplicate(id, payload),
    onSuccess: invalidateList,
  });
}

/** Soft-deleting an assessment also removes it from any trainee's assigned-assessments view. */
export function useDeleteAssessmentMutation() {
  const invalidateList = useInvalidateAssessmentsList();
  const invalidateTraineeSurfaces = useInvalidateTraineeAssessmentSurfaces();
  return useMutation({
    mutationFn: (id: string) => assessmentsApi.remove(id),
    onSuccess: () => {
      invalidateList();
      invalidateTraineeSurfaces();
    },
  });
}

export function useAssignGroupMutation() {
  const invalidate = useInvalidateAssessmentAssignments();
  return useMutation({
    mutationFn: ({ assessmentId, payload }: { assessmentId: string; payload: AssignGroupPayload }) =>
      assessmentsApi.assignGroup(assessmentId, payload),
    onSuccess: (_data, variables) => invalidate(variables.assessmentId),
  });
}

export function useUnassignGroupMutation() {
  const invalidate = useInvalidateAssessmentAssignments();
  return useMutation({
    mutationFn: ({ assessmentId, groupId }: { assessmentId: string; groupId: string }) =>
      assessmentsApi.unassignGroup(assessmentId, groupId),
    onSuccess: (_data, variables) => invalidate(variables.assessmentId),
  });
}

/* -------------------------------------------------------------------------- */
/* Assessment question (answer key) mutations                                 */
/* -------------------------------------------------------------------------- */

export function useAddQuestionMutation() {
  const invalidate = useInvalidateAssessmentQuestions();
  return useMutation({
    mutationFn: ({ assessmentId, payload }: { assessmentId: string; payload: AddQuestionPayload }) =>
      assessmentsApi.addQuestion(assessmentId, payload),
    onSuccess: (_data, variables) => invalidate(variables.assessmentId),
  });
}

export function useUpdateAssessmentQuestionMutation() {
  const invalidate = useInvalidateAssessmentQuestions();
  return useMutation({
    mutationFn: ({
      assessmentId,
      aqId,
      payload,
    }: {
      assessmentId: string;
      aqId: string;
      payload: UpdateAssessmentQuestionPayload;
    }) => assessmentsApi.updateQuestion(assessmentId, aqId, payload),
    onSuccess: (_data, variables) => invalidate(variables.assessmentId),
  });
}

export function useRemoveQuestionMutation() {
  const invalidate = useInvalidateAssessmentQuestions();
  return useMutation({
    mutationFn: ({ assessmentId, aqId }: { assessmentId: string; aqId: string }) =>
      assessmentsApi.removeQuestion(assessmentId, aqId),
    onSuccess: (_data, variables) => invalidate(variables.assessmentId),
  });
}

export function useReorderQuestionsMutation() {
  const invalidate = useInvalidateAssessmentQuestions();
  return useMutation({
    mutationFn: ({ assessmentId, payload }: { assessmentId: string; payload: ReorderQuestionsPayload }) =>
      assessmentsApi.reorderQuestions(assessmentId, payload),
    onSuccess: (_data, variables) => invalidate(variables.assessmentId),
  });
}

/* -------------------------------------------------------------------------- */
/* Attempt mutations (trainee-facing)                                        */
/* -------------------------------------------------------------------------- */

/** Starts a new attempt, or idempotently resumes an existing IN_PROGRESS one. */
export function useStartAttemptMutation() {
  const invalidateMine = useInvalidateAttemptMine();
  return useMutation({
    mutationFn: (assessmentId: string) => assessmentAttemptsApi.start(assessmentId),
    onSuccess: (_data, assessmentId) => invalidateMine(assessmentId),
  });
}

export function useSaveAnswerMutation() {
  const invalidateMine = useInvalidateAttemptMine();
  return useMutation({
    mutationFn: ({
      assessmentId,
      assessmentQuestionId,
      payload,
    }: {
      assessmentId: string;
      assessmentQuestionId: string;
      payload: UpsertAnswerPayload;
    }) => assessmentAttemptsApi.saveAnswer(assessmentId, assessmentQuestionId, payload),
    onSuccess: (_data, variables) => invalidateMine(variables.assessmentId),
  });
}

export function useUploadAnswerMutation() {
  const invalidateMine = useInvalidateAttemptMine();
  return useMutation({
    mutationFn: ({
      assessmentId,
      assessmentQuestionId,
      file,
    }: {
      assessmentId: string;
      assessmentQuestionId: string;
      file: File;
    }) => assessmentAttemptsApi.uploadAnswer(assessmentId, assessmentQuestionId, file),
    onSuccess: (_data, variables) => invalidateMine(variables.assessmentId),
  });
}

/** Submitting also updates the caller's own summary on `/assessments/mine` and the staff-facing pending-grading count. */
export function useSubmitAttemptMutation() {
  const invalidateMine = useInvalidateAttemptMine();
  const invalidateTraineeSurfaces = useInvalidateTraineeAssessmentSurfaces();
  const invalidateAssessmentsList = useInvalidateAssessmentsList();
  return useMutation({
    mutationFn: (assessmentId: string) => assessmentAttemptsApi.submit(assessmentId),
    onSuccess: (_data, assessmentId) => {
      invalidateMine(assessmentId);
      invalidateTraineeSurfaces();
      invalidateAssessmentsList();
    },
  });
}

export function useRecordIntegrityEventMutation() {
  return useMutation({
    mutationFn: ({ assessmentId, type }: { assessmentId: string; type: AssessmentIntegrityEventType }) =>
      assessmentAttemptsApi.recordIntegrityEvent(assessmentId, {
        type,
        occurredAt: new Date().toISOString(),
      }),
  });
}

/* -------------------------------------------------------------------------- */
/* Attempt mutations (trainer/admin-facing)                                  */
/* -------------------------------------------------------------------------- */

/** Grading changes that attempt's status/score, the attempts list, and the staff-facing pending-grading count. */
export function useGradeAnswerMutation() {
  const invalidateDetail = useInvalidateAttemptDetail();
  const invalidateList = useInvalidateAttemptsList();
  const invalidateAssessmentsList = useInvalidateAssessmentsList();
  return useMutation({
    mutationFn: ({
      assessmentId,
      attemptId,
      answerId,
      payload,
    }: {
      assessmentId: string;
      attemptId: string;
      answerId: string;
      payload: GradeAnswerPayload;
    }) => assessmentAttemptsApi.gradeAnswer(assessmentId, attemptId, answerId, payload),
    onSuccess: (_data, variables) => {
      invalidateDetail(variables.assessmentId, variables.attemptId);
      invalidateList(variables.assessmentId);
      invalidateAssessmentsList();
    },
  });
}
