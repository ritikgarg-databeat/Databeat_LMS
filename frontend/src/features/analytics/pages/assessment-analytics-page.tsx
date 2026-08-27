// Thin routed wrapper around `AssessmentAnalyticsPanel` — mounted at
// /{admin,trainer}/assessments/:id/analytics, linked from the assessment results page.
import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';

import { useAssessmentAnalyticsQuery } from '../hooks';

import { AssessmentAnalyticsPanel } from './assessment-analytics-panel';

function AssessmentAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAdminRoute = useLocation().pathname.startsWith('/admin');
  const resultsPath = isAdminRoute
    ? `/admin/assessments/${id}/results`
    : `/trainer/assessments/${id}/results`;
  // Same query the panel below makes — TanStack dedupes it, so this doesn't double-fetch; it
  // just lets the header name the assessment instead of a bare "Assessment Analytics" title.
  const { data } = useAssessmentAnalyticsQuery(id);

  if (!id) return null;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(resultsPath)} className="-ml-2">
        <ArrowLeft className="size-4" /> Back to results
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {data ? `${data.assessment.title} — Analytics` : 'Assessment Analytics'}
        </h1>
        <p className="text-muted-foreground">Participation, scoring, and weak topics for this assessment.</p>
      </div>
      <AssessmentAnalyticsPanel assessmentId={id} />
    </div>
  );
}

export { AssessmentAnalyticsPage };
