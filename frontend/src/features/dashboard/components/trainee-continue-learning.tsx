import { ArrowRight, CheckCircle2, CircleDashed, PlayCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatHours } from '@/features/analytics/components';
import type { ContinueLearningItem, CourseProgressStatus } from '@/features/analytics/types';

const MAX_ITEMS_SHOWN = 3;

const STATUS_ICON: Record<CourseProgressStatus, LucideIcon> = {
  NOT_STARTED: CircleDashed,
  IN_PROGRESS: PlayCircle,
  COMPLETED: CheckCircle2,
};

const STATUS_LABEL: Record<CourseProgressStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};

const STATUS_BADGE_VARIANT: Record<CourseProgressStatus, 'secondary' | 'warning' | 'success'> = {
  NOT_STARTED: 'secondary',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
};

export interface TraineeContinueLearningProps {
  items: ContinueLearningItem[];
}

/** Dashboard "pick up where you left off" strip — up to 3 horizontal cards. */
function TraineeContinueLearning({ items }: TraineeContinueLearningProps) {
  const shown = items.slice(0, MAX_ITEMS_SHOWN);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Continue Learning</h2>
      {shown.length === 0 ? (
        <EmptyState
          title="Nothing in progress right now"
          description="You're all caught up — start a course to see it here."
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {shown.map((item) => {
            const StatusIcon = STATUS_ICON[item.status];
            return (
              <Card key={item.lessonId} className="w-72 shrink-0">
                <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
                  <div className="space-y-1">
                    <p className="truncate text-xs text-muted-foreground">
                      {item.courseTitle} &middot; {item.moduleTitle}
                    </p>
                    <p className="line-clamp-2 font-medium leading-tight">{item.lessonTitle}</p>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={STATUS_BADGE_VARIANT[item.status]} className="gap-1">
                      <StatusIcon className="size-3" aria-hidden />
                      {STATUS_LABEL[item.status]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatHours(item.timeSpentSeconds)}</span>
                  </div>

                  <Button asChild size="sm" className="w-full">
                    <Link to={`/trainee/classroom/${item.courseId}/lessons/${item.lessonId}`}>
                      Resume <ArrowRight />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { TraineeContinueLearning };
