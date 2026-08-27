// React hooks (including TanStack Query hooks) for the qna (Q&A Discussion Platform) feature.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  qnaAnswersApi,
  qnaCommentsApi,
  qnaQuestionsApi,
  qnaSearchApi,
  qnaTagsApi,
  qnaVotesApi,
} from '../services';
import type {
  CreateAnswerPayload,
  CreateCommentPayload,
  CreateQuestionPayload,
  ListQuestionsParams,
  ListTagsParams,
  PinAnswerPayload,
  SearchParams,
  ToggleVotePayload,
  UpdateAnswerPayload,
  UpdateQuestionPayload,
  UpdateQuestionStatusPayload,
  VerifyAnswerPayload,
} from '../types';

const QNA_QUESTIONS_LIST_QUERY_KEY = 'qna-questions-list';
const QNA_QUESTION_DETAIL_QUERY_KEY = 'qna-question-detail';
const QNA_TAGS_QUERY_KEY = 'qna-tags';
const QNA_SEARCH_QUERY_KEY = 'qna-search';

/* -------------------------------------------------------------------------- */
/* Queries                                                                     */
/* -------------------------------------------------------------------------- */

export function useQnaQuestionsQuery(params: ListQuestionsParams) {
  return useQuery({
    queryKey: [QNA_QUESTIONS_LIST_QUERY_KEY, params],
    queryFn: () => qnaQuestionsApi.list(params),
    placeholderData: (previous) => previous,
  });
}

export function useQnaQuestionQuery(id: string | undefined) {
  return useQuery({
    queryKey: [QNA_QUESTION_DETAIL_QUERY_KEY, id],
    queryFn: () => qnaQuestionsApi.getById(id as string),
    enabled: Boolean(id),
  });
}

export function useQnaTagsQuery(params?: ListTagsParams) {
  return useQuery({
    queryKey: [QNA_TAGS_QUERY_KEY, params],
    queryFn: () => qnaTagsApi.list(params),
  });
}

export function useQnaSearchQuery(params: SearchParams) {
  return useQuery({
    queryKey: [QNA_SEARCH_QUERY_KEY, params],
    queryFn: () => qnaSearchApi.search(params),
    enabled: Boolean(params.q),
  });
}

/* -------------------------------------------------------------------------- */
/* Invalidation helpers                                                       */
/* -------------------------------------------------------------------------- */

function useInvalidateQnaQuestionsList() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: [QNA_QUESTIONS_LIST_QUERY_KEY] });
}

function useInvalidateQnaQuestionDetail() {
  const queryClient = useQueryClient();
  return (questionId: string) =>
    void queryClient.invalidateQueries({ queryKey: [QNA_QUESTION_DETAIL_QUERY_KEY, questionId] });
}

function useInvalidateQnaTags() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: [QNA_TAGS_QUERY_KEY] });
}

/**
 * The one helper nearly every mutation below calls: a question's detail view embeds its own
 * answers/comments/votes, so ANY mutation that touches an answer/comment/vote/attachment (not
 * just the question's own fields) must invalidate BOTH the list (`answersCount`/
 * `hasVerifiedAnswer`/`voteCount` shown there change too) and that one question's detail query.
 */
function useInvalidateQnaQuestion() {
  const invalidateList = useInvalidateQnaQuestionsList();
  const invalidateDetail = useInvalidateQnaQuestionDetail();
  return (questionId: string) => {
    invalidateList();
    invalidateDetail(questionId);
  };
}

/* -------------------------------------------------------------------------- */
/* Question mutations                                                         */
/* -------------------------------------------------------------------------- */

/** Tags may be new (or newly counted) as of this create — also invalidate the tags list. */
export function useCreateQuestionMutation() {
  const invalidateList = useInvalidateQnaQuestionsList();
  const invalidateTags = useInvalidateQnaTags();
  return useMutation({
    mutationFn: (payload: CreateQuestionPayload) => qnaQuestionsApi.create(payload),
    onSuccess: () => {
      invalidateList();
      invalidateTags();
    },
  });
}

/** `payload.tags` may change on update — also invalidate the tags list. */
export function useUpdateQuestionMutation() {
  const invalidateQuestion = useInvalidateQnaQuestion();
  const invalidateTags = useInvalidateQnaTags();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateQuestionPayload }) =>
      qnaQuestionsApi.update(id, payload),
    onSuccess: (_data, variables) => {
      invalidateQuestion(variables.id);
      invalidateTags();
    },
  });
}

/** Soft delete decrements any tags this question held — also invalidate the tags list. */
export function useDeleteQuestionMutation() {
  const invalidateList = useInvalidateQnaQuestionsList();
  const invalidateTags = useInvalidateQnaTags();
  return useMutation({
    mutationFn: (id: string) => qnaQuestionsApi.remove(id),
    onSuccess: () => {
      invalidateList();
      invalidateTags();
    },
  });
}

export function useUpdateQuestionStatusMutation() {
  const invalidateQuestion = useInvalidateQnaQuestion();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateQuestionStatusPayload }) =>
      qnaQuestionsApi.updateStatus(id, payload),
    onSuccess: (_data, variables) => invalidateQuestion(variables.id),
  });
}

export function useUploadAttachmentMutation() {
  const invalidateQuestion = useInvalidateQnaQuestion();
  return useMutation({
    mutationFn: ({ questionId, file }: { questionId: string; file: File }) =>
      qnaQuestionsApi.uploadAttachment(questionId, file),
    onSuccess: (_data, variables) => invalidateQuestion(variables.questionId),
  });
}

export function useRemoveAttachmentMutation() {
  const invalidateQuestion = useInvalidateQnaQuestion();
  return useMutation({
    mutationFn: ({ questionId, attachmentId }: { questionId: string; attachmentId: string }) =>
      qnaQuestionsApi.removeAttachment(questionId, attachmentId),
    onSuccess: (_data, variables) => invalidateQuestion(variables.questionId),
  });
}

export function useVerifyAnswerMutation() {
  const invalidateQuestion = useInvalidateQnaQuestion();
  return useMutation({
    mutationFn: ({ questionId, payload }: { questionId: string; payload: VerifyAnswerPayload }) =>
      qnaQuestionsApi.verifyAnswer(questionId, payload),
    onSuccess: (_data, variables) => invalidateQuestion(variables.questionId),
  });
}

/* -------------------------------------------------------------------------- */
/* Answer mutations                                                           */
/* -------------------------------------------------------------------------- */

/**
 * `questionId` is required as an explicit mutation variable purely for cache invalidation — the
 * create response is an answer row, not its parent question, so there's no other reliable way to
 * know which question's list/detail queries need refreshing. The caller (rendering the "add
 * answer" form on a specific question's page) always knows this value already.
 */
export function useCreateAnswerMutation() {
  const invalidateQuestion = useInvalidateQnaQuestion();
  return useMutation({
    mutationFn: (payload: CreateAnswerPayload) => qnaAnswersApi.create(payload),
    onSuccess: (_data, variables) => invalidateQuestion(variables.questionId),
  });
}

export function useUpdateAnswerMutation() {
  const invalidateQuestion = useInvalidateQnaQuestion();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; questionId: string; payload: UpdateAnswerPayload }) =>
      qnaAnswersApi.update(id, payload),
    onSuccess: (_data, variables) => invalidateQuestion(variables.questionId),
  });
}

export function useDeleteAnswerMutation() {
  const invalidateQuestion = useInvalidateQnaQuestion();
  return useMutation({
    mutationFn: ({ id }: { id: string; questionId: string }) => qnaAnswersApi.remove(id),
    onSuccess: (_data, variables) => invalidateQuestion(variables.questionId),
  });
}

export function usePinAnswerMutation() {
  const invalidateQuestion = useInvalidateQnaQuestion();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; questionId: string; payload: PinAnswerPayload }) =>
      qnaAnswersApi.pin(id, payload),
    onSuccess: (_data, variables) => invalidateQuestion(variables.questionId),
  });
}

/* -------------------------------------------------------------------------- */
/* Comment mutations                                                          */
/* -------------------------------------------------------------------------- */

/**
 * `questionId` is the PARENT question to invalidate. For a comment on the question itself this
 * equals `payload.questionId`, but for a comment on one of that question's answers, `payload`
 * only carries `answerId` — so the caller (rendering that answer inside a specific question's
 * page) must pass the owning question's id through explicitly, same pattern as the answer
 * mutations above.
 */
export function useCreateCommentMutation() {
  const invalidateQuestion = useInvalidateQnaQuestion();
  return useMutation({
    mutationFn: ({ payload }: { questionId: string; payload: CreateCommentPayload }) =>
      qnaCommentsApi.create(payload),
    onSuccess: (_data, variables) => invalidateQuestion(variables.questionId),
  });
}

export function useDeleteCommentMutation() {
  const invalidateQuestion = useInvalidateQnaQuestion();
  return useMutation({
    mutationFn: ({ id }: { id: string; questionId: string }) => qnaCommentsApi.remove(id),
    onSuccess: (_data, variables) => invalidateQuestion(variables.questionId),
  });
}

/* -------------------------------------------------------------------------- */
/* Vote mutations                                                             */
/* -------------------------------------------------------------------------- */

/** Same explicit-`questionId` pattern as comments above — the vote target may be an answer, not the question itself. */
export function useToggleVoteMutation() {
  const invalidateQuestion = useInvalidateQnaQuestion();
  return useMutation({
    mutationFn: ({ payload }: { questionId: string; payload: ToggleVotePayload }) =>
      qnaVotesApi.toggle(payload),
    onSuccess: (_data, variables) => invalidateQuestion(variables.questionId),
  });
}
