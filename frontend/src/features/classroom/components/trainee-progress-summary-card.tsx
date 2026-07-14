import { ArrowRight, BookOpen, Clock, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ErrorScreen } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { useProgressSummaryQuery } from '../hooks';

import { CourseProgressBar } from './course-progress-bar';

/** Trainee dashboard widget — overall learning progress figures plus a link into `MyClassroomPage`. */
function TraineeProgressSummaryCard() {
  const { data, isLoading, isError, refetch } = useProgressSummaryQuery();

  if (isError) {
    return <ErrorScreen message="Failed to load your progress summary." onRetry={() => void refetch()} />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>My Progress</CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link to="/trainee/classroom">
            My Classroom <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <>
            <CourseProgressBar percentage={data.overallCompletionPercentage} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <BookOpen className="size-3.5" aria-hidden /> Assigned Courses
                </p>
                <p className="text-xl font-semibold tracking-tight">{data.assignedCoursesCount}</p>
              </div>
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <GraduationCap className="size-3.5" aria-hidden /> Lessons Completed
                </p>
                <p className="text-xl font-semibold tracking-tight">
                  {data.completedLessonsCount}/{data.totalLessonsCount}
                </p>
              </div>
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" aria-hidden /> Hours Spent
                </p>
                <p className="text-xl font-semibold tracking-tight">{data.hoursSpent}</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export { TraineeProgressSummaryCard };
