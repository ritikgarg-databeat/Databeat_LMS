import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { EmptyState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { ProgressMeter } from '@/features/analytics/components';
import type { CourseProgressStatus, TraineeCourseProgress } from '@/features/analytics/types';

const STATUS_LABEL: Record<CourseProgressStatus, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

const STATUS_BADGE_VARIANT: Record<CourseProgressStatus, 'secondary' | 'warning' | 'success'> = {
  NOT_STARTED: 'secondary',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
};

export interface TraineeMyCoursesProps {
  courses: TraineeCourseProgress[];
}

/** Dashboard "My Courses" grid — title, progress meter, status, link into the course. */
function TraineeMyCourses({ courses }: TraineeMyCoursesProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">My Courses</h2>
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.TRAINEE.MY_PROGRESS}>
            View all <ArrowRight />
          </Link>
        </Button>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          title="No courses assigned yet"
          description="Check back once your trainer assigns you a course."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link key={course.courseId} to={`/trainee/classroom/${course.courseId}`}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader className="space-y-2">
                  <Badge variant={STATUS_BADGE_VARIANT[course.status]} className="w-fit">
                    {STATUS_LABEL[course.status]}
                  </Badge>
                  <CardTitle className="text-base">{course.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ProgressMeter value={course.completionPercentage} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export { TraineeMyCourses };
