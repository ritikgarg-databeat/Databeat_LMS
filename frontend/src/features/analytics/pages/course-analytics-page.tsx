// Thin routed wrapper around `CourseAnalyticsPanel` — mounted at
// /{admin,trainer}/classroom/:courseId/analytics, linked from the course editor's Actions menu.
import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';

import { useCourseAnalyticsQuery } from '../hooks';

import { CourseAnalyticsPanel } from './course-analytics-panel';

function CourseAnalyticsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const isAdminRoute = useLocation().pathname.startsWith('/admin');
  const courseEditorPath = isAdminRoute ? `/admin/classroom/${courseId}` : `/trainer/classroom/${courseId}`;
  // Same query the panel below makes — TanStack dedupes it, so this doesn't double-fetch; it
  // just lets the header name the course instead of a bare "Course Analytics" title.
  const { data } = useCourseAnalyticsQuery(courseId);

  if (!courseId) return null;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(courseEditorPath)} className="-ml-2">
        <ArrowLeft className="size-4" /> Back to course
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {data ? `${data.course.title} — Analytics` : 'Course Analytics'}
        </h1>
        <p className="text-muted-foreground">Completion, drop-off, and scoring for this course.</p>
      </div>
      <CourseAnalyticsPanel courseId={courseId} />
    </div>
  );
}

export { CourseAnalyticsPage };
