import {
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDashed,
  Download,
  Files,
  Lock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorScreen } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

import { CourseStatusBadge, DifficultyBadge, MandatoryCourseBadge } from '../components';
import { CourseProgressBar } from '../components/course-progress-bar';
import { useCourseProgressQuery, useMyCoursesQuery } from '../hooks';
import type { CourseModuleProgress, LessonProgressStatus } from '../types';
import { downloadCourseCertificate } from '../utils/course-certificate';

const LESSON_STATUS_ICON: Record<LessonProgressStatus, LucideIcon> = {
  NOT_STARTED: Circle,
  IN_PROGRESS: CircleDashed,
  COMPLETED: CheckCircle2,
};

const LESSON_STATUS_CLASS: Record<LessonProgressStatus, string> = {
  NOT_STARTED: 'text-muted-foreground',
  IN_PROGRESS: 'text-warning',
  COMPLETED: 'text-success',
};

interface ModuleSectionProps {
  courseId: string;
  module: CourseModuleProgress;
}

/** One collapsible module section — header (title + per-module progress) plus its lesson list. */
function ModuleSection({ courseId, module }: ModuleSectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        onClick={() => setExpanded((previous) => !previous)}
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-2">
          {expanded ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span className="truncate font-medium">{module.title}</span>
        </div>
        <div className="w-40 shrink-0">
          <CourseProgressBar percentage={module.percentage} />
        </div>
      </button>

      {expanded ? (
        <CardContent className="space-y-1 pt-0">
          {module.lessons.map((lesson) => {
            const StatusIcon = LESSON_STATUS_ICON[lesson.status];
            const content = (
              <>
                <StatusIcon
                  className={cn('size-4 shrink-0', LESSON_STATUS_CLASS[lesson.status])}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                {lesson.isLocked ? (
                  <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                ) : null}
                {lesson.hasNewContent ? (
                  <Badge variant="default" dot className="shrink-0">
                    New resource added
                  </Badge>
                ) : null}
              </>
            );
            return lesson.isLocked ? (
              <div
                key={lesson.lessonId}
                className="flex cursor-not-allowed items-center gap-2 rounded-md px-2 py-2 text-sm opacity-60"
                title={lesson.lockReason ?? undefined}
                aria-disabled="true"
              >
                {content}
              </div>
            ) : (
              <Link
                key={lesson.lessonId}
                to={`/trainee/classroom/${courseId}/lessons/${lesson.lessonId}`}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
              >
                {content}
              </Link>
            );
          })}
        </CardContent>
      ) : null}
    </Card>
  );
}

/**
 * Trainee's read-only view of one course's structure with progress. `useCourseProgressQuery`
 * supplies the progress-annotated module/lesson tree; `useMyCoursesQuery` (already fetched/cached
 * by `MyClassroomPage` in the common case, refetched here otherwise) supplies the course-level
 * title/description/badges that `CourseProgressBreakdown` itself doesn't carry.
 */
function TraineeCourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { data: myCourses } = useMyCoursesQuery();
  const { data: progress, isLoading, isError, refetch } = useCourseProgressQuery(courseId);
  const { user } = useAuth();

  const course = myCourses?.find((item) => item.id === courseId);

  if (!courseId) return null;

  if (isError) {
    return <ErrorScreen message="Failed to load this course's progress." onRetry={() => void refetch()} />;
  }

  if (isLoading || !progress) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-6 w-full max-w-sm" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const lessons = progress.modules.flatMap((module) => module.lessons);
  const completedLessons = lessons.filter((lesson) => lesson.status === 'COMPLETED').length;
  const resourcesReviewed = lessons.reduce((sum, lesson) => sum + lesson.completedResourceCount, 0);
  const resourcesRequired = lessons.reduce((sum, lesson) => sum + lesson.requiredResourceCount, 0);
  const isCourseComplete = lessons.length > 0 && progress.overallPercentage === 100;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{course?.title ?? 'Course'}</h1>
          {course ? (
            <>
              <CourseStatusBadge status={course.status} />
              <DifficultyBadge difficulty={course.difficulty} />
              {course.isMandatory ? <MandatoryCourseBadge /> : null}
            </>
          ) : null}
        </div>
        {course?.description ? <p className="text-muted-foreground">{course.description}</p> : null}
        <div className="max-w-sm">
          <CourseProgressBar percentage={progress.overallPercentage} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryMetric
          icon={CheckCircle2}
          label="Lessons completed"
          value={`${completedLessons}/${lessons.length}`}
        />
        <SummaryMetric
          icon={Files}
          label="Resources reviewed"
          value={`${resourcesReviewed}/${resourcesRequired}`}
        />
        <SummaryMetric
          icon={Award}
          label="Course status"
          value={isCourseComplete ? 'Completed' : `${lessons.length - completedLessons} remaining`}
        />
      </div>

      <Card
        className={cn(
          'transition-opacity',
          isCourseComplete ? 'border-success/40 bg-success/5' : 'opacity-60',
        )}
      >
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="font-semibold">
              {isCourseComplete ? 'Course completed' : 'Completion certificate'}
            </p>
            <p className="text-sm text-muted-foreground">
              {isCourseComplete
                ? 'All current lessons and required learning resources are complete.'
                : 'Complete every lesson and required resource to unlock your certificate.'}
            </p>
          </div>
          <Button
            type="button"
            disabled={!isCourseComplete || !user}
            onClick={() =>
              user &&
              isCourseComplete &&
              downloadCourseCertificate({
                learnerName: user.fullName,
                courseTitle: course?.title ?? 'Course',
              })
            }
          >
            <Download className="size-4" aria-hidden /> Download certificate
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {progress.modules.map((module) => (
          <ModuleSection key={module.moduleId} courseId={courseId} module={module} />
        ))}
      </div>
    </div>
  );
}

function SummaryMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export { TraineeCourseDetailPage };
