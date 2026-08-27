// Previous/Next lesson navigation. Learners move across the course's flattened published
// module/lesson sequence; staff preview navigation remains scoped to the current module.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useCourseProgressQuery, useLessonsQuery } from '../hooks';

export interface LessonNavigationProps {
  moduleId: string;
  currentLessonId: string;
  courseId: string;
  /** Role-scoped route root (`/admin`, `/trainer`, or `/trainee`) the sibling links are built under. */
  basePath: string;
  /**
   * `GET /lessons?moduleId=` (used to list ALL sibling lessons, including drafts) is a
   * Trainer/Super-Admin-only management endpoint — a Trainee calling it gets a 403. In 'learn'
   * mode we instead source siblings from `GET /progress/courses/:courseId`, which a Trainee can
   * always reach and which already only lists published lessons in the correct order.
   */
  mode: 'preview' | 'learn';
}

interface OrderedSibling {
  id: string;
  title: string;
  isLocked?: boolean;
}

/** Previous/Next buttons for the role-appropriate ordered lesson sequence. */
function LessonNavigation({ moduleId, currentLessonId, courseId, basePath, mode }: LessonNavigationProps) {
  const { data: lessons, isLoading: lessonsLoading } = useLessonsQuery(
    mode === 'preview' ? moduleId : undefined,
  );
  const { data: progress, isLoading: progressLoading } = useCourseProgressQuery(
    mode === 'learn' ? courseId : undefined,
  );

  if (mode === 'preview' ? lessonsLoading : progressLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  const orderedLessons: OrderedSibling[] =
    mode === 'preview'
      ? [...(lessons ?? [])]
          .sort((a, b) => a.order - b.order)
          .map((lesson) => ({ id: lesson.id, title: lesson.title }))
      : (progress?.modules.flatMap((courseModule) =>
          courseModule.lessons.map((lesson) => ({
            id: lesson.lessonId,
            title: lesson.title,
            isLocked: lesson.isLocked,
          })),
        ) ?? []);

  const currentIndex = orderedLessons.findIndex((lesson) => lesson.id === currentLessonId);
  const previousLesson: OrderedSibling | undefined =
    currentIndex > 0 ? orderedLessons[currentIndex - 1] : undefined;
  const nextLesson: OrderedSibling | undefined =
    currentIndex >= 0 && currentIndex < orderedLessons.length - 1
      ? orderedLessons[currentIndex + 1]
      : undefined;

  const lessonHref = (id: string) => `${basePath}/classroom/${courseId}/lessons/${id}`;

  return (
    <nav className="flex items-center justify-between gap-3 border-t pt-4" aria-label="Lesson navigation">
      {previousLesson ? (
        <Link to={lessonHref(previousLesson.id)} className={cn(buttonVariants({ variant: 'outline' }))}>
          <ChevronLeft />
          <span className="max-w-40 truncate">{previousLesson.title}</span>
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className={cn(buttonVariants({ variant: 'outline' }), 'pointer-events-none opacity-50')}
        >
          <ChevronLeft /> Previous
        </span>
      )}

      {nextLesson && !nextLesson.isLocked ? (
        <Link to={lessonHref(nextLesson.id)} className={cn(buttonVariants({ variant: 'outline' }))}>
          <span className="max-w-40 truncate">{nextLesson.title}</span>
          <ChevronRight />
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className={cn(buttonVariants({ variant: 'outline' }), 'pointer-events-none opacity-50')}
        >
          Next <ChevronRight />
        </span>
      )}
    </nav>
  );
}

export { LessonNavigation };
