import { ArrowRight, CheckCircle2, CircleDashed, PlayCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ErrorScreen } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime } from '@/utils/date';

import { useContinueLearningQuery } from '../hooks';
import type { LessonProgressStatus } from '../types';

const STATUS_ICON: Record<LessonProgressStatus, LucideIcon> = {
  NOT_STARTED: CircleDashed,
  IN_PROGRESS: PlayCircle,
  COMPLETED: CheckCircle2,
};

const STATUS_LABEL: Record<LessonProgressStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};

const STATUS_BADGE_VARIANT: Record<LessonProgressStatus, 'secondary' | 'warning' | 'success'> = {
  NOT_STARTED: 'secondary',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
};

/**
 * Trainee "pick up where you left off" strip — used at the top of `MyClassroomPage` and on the
 * trainee dashboard. A trainee with nothing in progress yet (or who has finished everything) is a
 * normal, expected state, not an error — render a minimal note rather than a jarring empty state.
 */
function ContinueLearningSection() {
  const { data, isLoading, isError, refetch } = useContinueLearningQuery();

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-36 w-72 shrink-0" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorScreen
        className="min-h-32"
        message="Failed to load your continue-learning list."
        onRetry={() => void refetch()}
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You&apos;re all caught up — nothing in progress right now.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Continue learning</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {data.map((item) => {
          const StatusIcon = STATUS_ICON[item.status];
          return (
            <Card key={item.lessonId} className="w-72 shrink-0">
              <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
                <div className="space-y-1">
                  <p className="truncate text-xs text-muted-foreground">
                    {item.courseTitle} &middot; {item.moduleTitle}
                  </p>
                  <p className="line-clamp-2 font-medium leading-tight">{item.lessonTitle}</p>
                  {item.hasNewContent ? (
                    <Badge variant="default" dot className="mt-2">
                      New resource added
                    </Badge>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Badge variant={STATUS_BADGE_VARIANT[item.status]} className="gap-1">
                    <StatusIcon className="size-3" aria-hidden />
                    {STATUS_LABEL[item.status]}
                  </Badge>
                  {item.lastViewedAt ? (
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(item.lastViewedAt)}
                    </span>
                  ) : null}
                </div>

                <Button asChild size="sm" className="w-full">
                  <Link to={`/trainee/classroom/${item.courseId}/lessons/${item.lessonId}`}>
                    Continue <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export { ContinueLearningSection };
