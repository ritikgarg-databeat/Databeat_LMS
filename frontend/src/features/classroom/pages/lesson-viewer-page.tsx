// The core content-consumption experience, shared by three router branches (`/admin`,
// `/trainer`, `/trainee`) — same component, behavior driven entirely by the current user's role:
//   - SUPER_ADMIN/TRAINER ("preview" mode): read-only, no progress tracking, "Back to editor".
//   - TRAINEE ("learn" mode): auto-tracks progress, "Mark as complete", "Back to course".
import { CheckCircle2, ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { ErrorScreen, LoadingScreen } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { ROLES, type Role } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';
import { LessonAiButton } from '@/features/ai/components';
import { useAuth } from '@/hooks/use-auth';
import { getErrorMessage } from '@/utils/error';

import { LessonContentRenderer } from '../components/lesson-content-renderer';
import { LessonNavigation } from '../components/lesson-navigation';
import { LessonQuizDialog } from '../components/lesson-quiz-dialog';
import { useLessonQuery, useLessonQuizMutation, useUpsertLessonProgressMutation } from '../hooks';
import type { SanitizedQuizQuestion } from '../types';

type ViewerMode = 'preview' | 'learn';

/** How often (ms) accumulated time-on-page is flushed to the server while the lesson is open. */
const PROGRESS_FLUSH_INTERVAL_MS = 30_000;

function basePathForRole(role: Role | undefined): string {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return ROUTES.ADMIN.ROOT;
    case ROLES.TRAINER:
      return ROUTES.TRAINER.ROOT;
    case ROLES.TRAINEE:
    default:
      return ROUTES.TRAINEE.ROOT;
  }
}

function LessonViewerPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const { user } = useAuth();
  const role = user?.role;
  const mode: ViewerMode = role === ROLES.TRAINEE ? 'learn' : 'preview';
  const basePath = basePathForRole(role);

  const { data: lesson, isLoading, isError, error, refetch } = useLessonQuery(lessonId);
  // Two SEPARATE mutation instances, deliberately not shared: `upsertProgress` is only ever
  // invoked from inside effects (the mount ping, the periodic flush) via `upsertProgressRef`,
  // while `markComplete` is only ever invoked from the button's click handler. Under React
  // StrictMode's dev-only double-invocation of effects, a mutation fired from inside an effect
  // can resolve after its render pass's subscription has already been torn down/re-established,
  // leaving that mutation's exposed `isPending`/`status` permanently stuck (confirmed empirically:
  // disabling StrictMode made it settle correctly every time). A mutation fired from a real click
  // handler is never subject to that double-invoke dance, so keeping the button's disabled/pending
  // state on its own dedicated instance sidesteps the bug entirely instead of chasing its cause.
  const upsertProgress = useUpsertLessonProgressMutation();
  const markComplete = useUpsertLessonProgressMutation();
  const lessonQuiz = useLessonQuizMutation();
  const [quizQuestions, setQuizQuestions] = useState<SanitizedQuizQuestion[] | null>(null);
  const [isQuizDialogOpen, setIsQuizDialogOpen] = useState(false);

  // Stashed in a ref so the effects below can call the latest mutation without needing it in
  // their dependency arrays (the mutation object's identity isn't guaranteed stable render over
  // render, and re-running the interval/mount effect just because of that would be wrong). Synced
  // in an effect (not during render) since refs must only be written outside of render.
  const upsertProgressRef = useRef(upsertProgress);
  useEffect(() => {
    upsertProgressRef.current = upsertProgress;
  });

  const initializedLessonRef = useRef<string | null>(null);
  // Set for real by the mount effect below, before it's ever read — the placeholder value here
  // just avoids calling `Date.now()` (an impure function) during render.
  const lastFlushAtRef = useRef(0);

  // Fire once per lesson, trainee mode only: bumps `lastViewedAt` server-side so this lesson
  // surfaces correctly in "Continue learning". Deliberately omits `status` — the backend only
  // defaults a BRAND NEW progress row to IN_PROGRESS when `status` is absent, but for an EXISTING
  // row it falls back to `existing.status` (see progress.service.ts's upsert). Sending an explicit
  // `status: 'IN_PROGRESS'` here would silently regress an already-COMPLETED lesson back to
  // in-progress every time it's reopened (e.g. via prev/next nav or "Continue learning" itself).
  useEffect(() => {
    if (mode !== 'learn' || !lessonId) return;
    if (initializedLessonRef.current === lessonId) return;
    initializedLessonRef.current = lessonId;
    lastFlushAtRef.current = Date.now();
    upsertProgressRef.current.mutate({ lessonId, payload: {} });
  }, [mode, lessonId]);

  // Flush accumulated time-on-page every 30s, and once more on unmount/lesson change so the tail
  // end of a session isn't lost.
  useEffect(() => {
    if (mode !== 'learn' || !lessonId) return;

    const flush = () => {
      const elapsedSeconds = Math.round((Date.now() - lastFlushAtRef.current) / 1000);
      lastFlushAtRef.current = Date.now();
      if (elapsedSeconds > 0) {
        upsertProgressRef.current.mutate({ lessonId, payload: { timeSpentSecondsDelta: elapsedSeconds } });
      }
    };

    const intervalId = setInterval(flush, PROGRESS_FLUSH_INTERVAL_MS);
    return () => {
      clearInterval(intervalId);
      flush();
    };
  }, [mode, lessonId]);

  if (!courseId || !lessonId) return null;

  if (isError) {
    return (
      <ErrorScreen title="Unable to load this lesson" message={getErrorMessage(error)} onRetry={() => void refetch()} />
    );
  }

  if (isLoading || !lesson) {
    return <LoadingScreen message="Loading lesson..." fullScreen={false} />;
  }

  const isCompleted = lesson.progress?.status === 'COMPLETED';
  const backHref = `${basePath}/classroom/${courseId}`;
  const backLabel = mode === 'preview' ? 'Back to editor' : 'Back to course';

  const completeLesson = () => {
    markComplete.mutate(
      { lessonId, payload: { status: 'COMPLETED' } },
      {
        onSuccess: () => toast.success('Lesson marked as complete.'),
        onError: (mutationError) => toast.error(getErrorMessage(mutationError)),
      },
    );
  };

  // Always checks whether this lesson requires its AI-generated completion quiz first — a
  // lesson with no real content (or no AI configured) resolves `required: false` and completes
  // immediately, identical to this app's original direct-complete behavior. See
  // backend/src/modules/lesson-quiz/README.md § The completion gate for why the backend enforces
  // this too, not just the UI.
  const handleMarkComplete = async () => {
    try {
      const view = await lessonQuiz.mutateAsync(lessonId);
      if (view.required && view.status === 'GENERATED') {
        setQuizQuestions(view.questions);
        setIsQuizDialogOpen(true);
        return;
      }
      completeLesson();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleQuizCompleted = () => {
    setIsQuizDialogOpen(false);
    completeLesson();
  };

  const handleVideoEnded = () => {
    if (!isCompleted) void handleMarkComplete();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link to={backHref}>
            <ChevronLeft /> {backLabel}
          </Link>
        </Button>

        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={backHref}>{lesson.module.course.title}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{lesson.module.title}</BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{lesson.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
            {lesson.description ? <p className="mt-1 text-sm text-muted-foreground">{lesson.description}</p> : null}
          </div>

          {mode === 'learn' ? (
            <div className="flex items-center gap-2">
              <LessonAiButton lessonId={lessonId} />
              {isCompleted ? (
                <Badge variant="success" className="gap-1.5 px-3 py-1.5 text-sm">
                  <CheckCircle2 className="size-4" /> Completed
                </Badge>
              ) : (
                <Button
                  onClick={() => void handleMarkComplete()}
                  disabled={markComplete.isPending || lessonQuiz.isPending}
                >
                  <CheckCircle2 /> {lessonQuiz.isPending ? 'Preparing quiz...' : 'Mark as complete'}
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <LessonContentRenderer
        lessonId={lesson.id}
        resources={lesson.resources}
        lessonType={lesson.type}
        onVideoEnded={mode === 'learn' ? handleVideoEnded : undefined}
      />

      <LessonNavigation
        moduleId={lesson.moduleId}
        currentLessonId={lesson.id}
        courseId={courseId}
        basePath={basePath}
        mode={mode}
      />

      {quizQuestions ? (
        <LessonQuizDialog
          lessonId={lessonId}
          open={isQuizDialogOpen}
          onOpenChange={setIsQuizDialogOpen}
          questions={quizQuestions}
          onCompleted={handleQuizCompleted}
        />
      ) : null}
    </div>
  );
}

export { LessonViewerPage };
