// The core "exam-taking" experience — `/trainee/assessments/:id/take`. Starts (or idempotently
// resumes) the attempt on mount, renders every question on one scrollable page with a real,
// self-enforcing countdown timer, autosaves answers on a short debounce, and submits (manually or
// on timeout) behind a confirmation dialog.
import { isAxiosError } from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { ConfirmDialog, ErrorScreen, LoadingScreen } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { getErrorMessage } from '@/utils/error';

import { AssessmentTimer } from '../components/assessment-timer';
import { QuestionRenderer } from '../components/question-renderer';
import {
  useAssessmentQuery,
  useSaveAnswerMutation,
  useStartAttemptMutation,
  useSubmitAttemptMutation,
  useUploadAnswerMutation,
} from '../hooks';
import type { Attempt, SanitizedAttemptQuestion, UpsertAnswerPayload } from '../types';

/** How long (ms) to wait after the last keystroke/selection before autosaving an answer. */
const AUTOSAVE_DEBOUNCE_MS = 900;

type AnswerValue = string | string[];
type AnswersState = Record<string, AnswerValue>;

function isAnswered(value: AnswerValue | undefined): boolean {
  if (value === undefined) return false;
  return Array.isArray(value) ? value.length > 0 : value.trim().length > 0;
}

function initialAnswerValue(question: SanitizedAttemptQuestion): AnswerValue {
  const saved = question.savedAnswer;
  switch (question.snapshotType) {
    case 'SINGLE_CORRECT_MCQ':
    case 'TRUE_FALSE':
      return saved?.selectedOptionIds?.[0] ?? '';
    case 'MULTIPLE_CORRECT':
      return saved?.selectedOptionIds ?? [];
    case 'FILE_UPLOAD':
      return saved?.fileOriginalFilename ?? '';
    case 'CODE_SNIPPET':
      return saved?.textAnswer ?? question.snapshotStarterCode ?? '';
    default:
      return saved?.textAnswer ?? '';
  }
}

function buildInitialAnswers(questions: SanitizedAttemptQuestion[]): AnswersState {
  const answers: AnswersState = {};
  for (const question of questions) {
    answers[question.id] = initialAnswerValue(question);
  }
  return answers;
}

function answerToPayload(question: SanitizedAttemptQuestion, value: AnswerValue): UpsertAnswerPayload {
  if (question.snapshotType === 'SINGLE_CORRECT_MCQ' || question.snapshotType === 'TRUE_FALSE') {
    return { selectedOptionIds: typeof value === 'string' && value ? [value] : [] };
  }
  if (question.snapshotType === 'MULTIPLE_CORRECT') {
    return { selectedOptionIds: Array.isArray(value) ? value : [] };
  }
  return { textAnswer: typeof value === 'string' ? value : '' };
}

function AssessmentPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: assessment, isLoading: isAssessmentLoading, isError: isAssessmentError } = useAssessmentQuery(id);

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<SanitizedAttemptQuestion[]>([]);
  const [answers, setAnswers] = useState<AnswersState>({});
  const [startError, setStartError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // `startAttempt` is only ever invoked from inside the mount effect below (never from a click
  // handler), while `submitAttempt` is only ever invoked from the confirm dialog / timer expiry.
  // Kept as separate `useMutation()` instances — see `lesson-viewer-page.tsx`'s comment on
  // `upsertProgress`/`markComplete`: a mutation fired from inside an effect can leave its exposed
  // `isPending`/`status` permanently stuck under React 19 StrictMode's dev-only double-invocation
  // of effects, even though the network call itself succeeds. Sharing the effect-fired instance
  // with a button whose disabled/pending state the user actually sees would risk that bug leaking
  // into visible UI; keeping them separate sidesteps it entirely.
  const startAttempt = useStartAttemptMutation();
  const submitAttempt = useSubmitAttemptMutation();
  const saveAnswer = useSaveAnswerMutation();
  const uploadAnswer = useUploadAnswerMutation();

  const startAttemptRef = useRef(startAttempt);
  useEffect(() => {
    startAttemptRef.current = startAttempt;
  });

  // Guards against double-firing `start` under StrictMode's dev-only double-invocation of effects
  // (and against re-firing on every unrelated re-render) — matches the `initializedLessonRef`
  // pattern in `lesson-viewer-page.tsx`. Bumping `retryToken` (the "try again" button) forces a
  // fresh key so the guard allows exactly one more attempt.
  //
  // Deliberately `mutateAsync` + a plain try/catch here, NOT `.mutate(id, {onSuccess, onError})`.
  // StrictMode's double-invocation tears down and rebuilds this mutation's internal observer
  // between the two effect passes; that observer teardown can orphan a per-call onSuccess/onError
  // pair registered on the FIRST pass's `.mutate()` even though the underlying request the guard
  // above correctly let through still completes — confirmed empirically (the network call
  // succeeds, but `onSuccess`/`onError` never fire, so `attempt` stays null and the trainee is
  // stuck on "Preparing your assessment..." forever). `mutateAsync`'s returned promise settles
  // off the actual request chain rather than that observer wiring, so awaiting it directly here
  // is unaffected by the teardown. Comparing `startedKeyRef.current` to this closure's own `key`
  // after the await (instead of a cleanup-set `cancelled` flag) discards a stale in-flight result
  // only when a *real* retry has superseded it — a StrictMode-only second pass never changes
  // `startedKeyRef`, so this pass's own result is still applied when it resolves.
  const startedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const key = `${id}:${retryToken}`;
    if (startedKeyRef.current === key) return;
    startedKeyRef.current = key;

    setStartError(null);

    void (async () => {
      try {
        const response = await startAttemptRef.current.mutateAsync(id);
        if (startedKeyRef.current !== key) return;
        setAttempt(response.attempt);
        setQuestions(response.questions);
        setAnswers(buildInitialAnswers(response.questions));
      } catch (error) {
        if (startedKeyRef.current !== key) return;
        const httpStatus = isAxiosError(error) ? error.response?.status : undefined;
        if (httpStatus === 409) {
          // Already finished (SUBMITTED/PENDING_REVIEW/GRADED) — nothing to play, go see results.
          navigate(`${ROUTES.TRAINEE.ASSESSMENTS}/${id}/result`, { replace: true });
          return;
        }
        setStartError(getErrorMessage(error));
      }
    })();
  }, [id, navigate, retryToken]);

  const debounceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Kept in sync every render (never stale) so the unmount-flush cleanup below — which is set up
  // once with an empty dependency array — can still read the LATEST answers/questions/id/mutation
  // when it actually runs, rather than whatever was in scope on the render that registered it.
  const latestRef = useRef({ id, answers, questions, saveAnswer });
  useEffect(() => {
    latestRef.current = { id, answers, questions, saveAnswer };
  });

  useEffect(() => {
    const timers = debounceTimersRef.current;
    return () => {
      // Best-effort on unmount (e.g. the trainee navigates away mid-debounce): fire whatever
      // saves were still pending rather than just discarding them — there's nothing left to await
      // once the component is gone, but firing the request is strictly better than silently
      // dropping the trainee's last edit.
      const { id: currentId, answers: currentAnswers, questions: currentQuestions, saveAnswer: currentSaveAnswer } =
        latestRef.current;
      for (const questionId of Object.keys(timers)) {
        clearTimeout(timers[questionId]);
        if (!currentId) continue;
        const question = currentQuestions.find((candidate) => candidate.id === questionId);
        const value = currentAnswers[questionId];
        if (!question || value === undefined) continue;
        currentSaveAnswer.mutate({
          assessmentId: currentId,
          assessmentQuestionId: questionId,
          payload: answerToPayload(question, value),
        });
      }
    };
  }, []);

  const hasSubmittedRef = useRef(false);

  /**
   * Flushes any answers still sitting in the autosave debounce window, AWAITING each one, so a
   * trainee who edits an answer and immediately hits Submit (within the ~900ms debounce) never
   * has that edit silently lost to a save that was still pending when grading ran.
   */
  const flushPendingAnswers = async (): Promise<void> => {
    if (!id) return;
    const pendingQuestionIds = Object.keys(debounceTimersRef.current);
    if (pendingQuestionIds.length === 0) return;

    pendingQuestionIds.forEach((questionId) => clearTimeout(debounceTimersRef.current[questionId]));
    debounceTimersRef.current = {};

    await Promise.all(
      pendingQuestionIds.map(async (questionId) => {
        const question = questions.find((candidate) => candidate.id === questionId);
        const value = answers[questionId];
        if (!question || value === undefined) return;
        try {
          await saveAnswer.mutateAsync({
            assessmentId: id,
            assessmentQuestionId: questionId,
            payload: answerToPayload(question, value),
          });
        } catch {
          toast.error(`Failed to save your answer for question ${question.position} before submitting.`);
        }
      }),
    );
  };

  const handleSubmit = async () => {
    if (!id || hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    await flushPendingAnswers();
    submitAttempt.mutate(id, {
      onSuccess: () => {
        navigate(`${ROUTES.TRAINEE.ASSESSMENTS}/${id}/result`, { replace: true });
      },
      onError: (error) => {
        hasSubmittedRef.current = false;
        toast.error(getErrorMessage(error));
      },
    });
  };

  const handleAnswerChange = (question: SanitizedAttemptQuestion, value: AnswerValue) => {
    if (!id) return;
    setAnswers((previous) => ({ ...previous, [question.id]: value }));

    const existingTimer = debounceTimersRef.current[question.id];
    if (existingTimer) clearTimeout(existingTimer);

    debounceTimersRef.current[question.id] = setTimeout(() => {
      delete debounceTimersRef.current[question.id];
      saveAnswer.mutate(
        { assessmentId: id, assessmentQuestionId: question.id, payload: answerToPayload(question, value) },
        { onError: () => toast.error(`Failed to save your answer for question ${question.position}.`) },
      );
    }, AUTOSAVE_DEBOUNCE_MS);
  };

  const handleFileSelect = (question: SanitizedAttemptQuestion, file: File) => {
    if (!id) return;
    uploadAnswer.mutate(
      { assessmentId: id, assessmentQuestionId: question.id, file },
      {
        onSuccess: (savedAnswer) => {
          setAnswers((previous) => ({
            ...previous,
            [question.id]: savedAnswer.fileOriginalFilename ?? file.name,
          }));
          toast.success('File uploaded.');
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  const answeredCount = useMemo(
    () => questions.filter((question) => isAnswered(answers[question.id])).length,
    [questions, answers],
  );

  const totalSeconds = useMemo(() => {
    if (!assessment || !attempt) return 0;
    return Math.max(0, assessment.durationMinutes * 60 - attempt.timeSpentSeconds);
  }, [assessment, attempt]);

  if (!id) return null;

  if (startError) {
    return (
      <ErrorScreen
        title="Unable to start this assessment"
        message={startError}
        onRetry={() => setRetryToken((token) => token + 1)}
      />
    );
  }

  if (isAssessmentError) {
    return <ErrorScreen title="Unable to load this assessment" />;
  }

  if (isAssessmentLoading || !assessment || !attempt) {
    return <LoadingScreen message="Preparing your assessment..." fullScreen={false} />;
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{assessment.title}</h1>
          <p className="text-sm text-muted-foreground">
            {answeredCount} of {questions.length} answered
          </p>
        </div>
        <AssessmentTimer totalSeconds={totalSeconds} onExpire={() => void handleSubmit()} />
      </div>

      <div className="space-y-4">
        {questions.map((question) => (
          <Card key={question.id}>
            <CardHeader>
              <CardTitle className="flex items-baseline justify-between gap-2 text-base">
                <span>
                  Question {question.position}. {question.snapshotTitle}
                </span>
                <span className="shrink-0 text-sm font-normal text-muted-foreground">
                  {question.marks} mark{question.marks === 1 ? '' : 's'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QuestionRenderer
                question={question}
                value={answers[question.id] ?? ''}
                onChange={(value) => handleAnswerChange(question, value)}
                onFileSelect={(file) => handleFileSelect(question, file)}
                disabled={submitAttempt.isPending}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={() => setConfirmOpen(true)} disabled={submitAttempt.isPending}>
          {submitAttempt.isPending ? 'Submitting...' : 'Submit'}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Submit assessment?"
        description="Are you sure? You cannot change your answers after submitting."
        confirmLabel="Submit"
        onConfirm={() => {
          setConfirmOpen(false);
          void handleSubmit();
        }}
      />
    </div>
  );
}

export { AssessmentPlayerPage };
