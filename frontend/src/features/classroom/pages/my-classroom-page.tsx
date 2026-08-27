import { Link } from 'react-router-dom';

import { EmptyState, ErrorScreen } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { CourseStatusBadge, DifficultyBadge, MandatoryCourseBadge } from '../components';
import { ContinueLearningSection } from '../components/continue-learning-section';
import { CourseProgressBar } from '../components/course-progress-bar';
import { useMyCoursesQuery } from '../hooks';

/** Trainee-facing "My Classroom" — assigned courses plus a continue-learning strip. */
function MyClassroomPage() {
  const { data: courses, isLoading, isError, refetch } = useMyCoursesQuery();

  if (isError) {
    return <ErrorScreen message="Failed to load your courses." onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Classroom</h1>
        <p className="text-muted-foreground">Your assigned courses and learning progress.</p>
      </div>

      <ContinueLearningSection />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Assigned courses</h2>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : !courses || courses.length === 0 ? (
          <EmptyState
            title="No courses assigned yet"
            description="Check back once your trainer assigns you a course."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Link key={course.id} to={`/trainee/classroom/${course.id}`}>
                <Card className="h-full transition-colors hover:border-primary">
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CourseStatusBadge status={course.status} />
                      <DifficultyBadge difficulty={course.difficulty} />
                      {course.isMandatory ? <MandatoryCourseBadge /> : null}
                    </div>
                    <CardTitle className="text-base">{course.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {course.moduleCount} {course.moduleCount === 1 ? 'module' : 'modules'} &middot;{' '}
                      {course.lessonCount} {course.lessonCount === 1 ? 'lesson' : 'lessons'}
                    </p>
                    <CourseProgressBar percentage={course.completionPercentage} />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { MyClassroomPage };
