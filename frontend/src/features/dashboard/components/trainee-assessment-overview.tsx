import { ArrowRight, CheckCircle2, ClipboardList, Target } from 'lucide-react';
import { Link } from 'react-router-dom';

import { StatCard } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ROUTES } from '@/constants/routes';
import { formatPercent } from '@/features/analytics/components';
import type { TraineeAssessmentsSummary } from '@/features/analytics/types';
import { formatDate } from '@/utils/date';

export interface TraineeAssessmentOverviewProps {
  assessments: TraineeAssessmentsSummary;
}

/** Dashboard "Assessment Overview" — average/taken/passed stats, upcoming list, recent results. */
function TraineeAssessmentOverview({ assessments }: TraineeAssessmentOverviewProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Assessment Overview</h2>
        <Button asChild variant="outline" size="sm">
          <Link to={ROUTES.TRAINEE.MY_PERFORMANCE}>
            View all <ArrowRight />
          </Link>
        </Button>
      </div>

      {/*
       * Unlike the trainer overview row (six unrelated categories, one color per metric), these
       * three tiles are all sub-facets of a single "Assessment Overview" topic — a single
       * consistent primary tint reads as one cohesive summary rather than fragmenting it into
       * three unrelated-looking colors. Pass/fail semantics are already carried by the Badge
       * colors in the "Recent Results" table below, so this row doesn't need to duplicate them.
       */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Average Score"
          value={assessments.averageScore === null ? '—' : formatPercent(assessments.averageScore)}
          icon={Target}
          accentColor="var(--primary)"
        />
        <StatCard label="Taken" value={assessments.taken} icon={ClipboardList} accentColor="var(--primary)" />
        <StatCard label="Passed" value={assessments.passed} icon={CheckCircle2} accentColor="var(--primary)" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            {assessments.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming assessments.</p>
            ) : (
              <ul className="space-y-2">
                {assessments.upcoming.map((item) => (
                  <li key={item.assessmentId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{item.title}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {item.dueDate ? formatDate(item.dueDate) : 'No due date'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Results</CardTitle>
          </CardHeader>
          <CardContent>
            {assessments.recentResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">No results yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assessment</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessments.recentResults.map((result) => (
                    <TableRow key={result.assessmentId}>
                      <TableCell className="max-w-40 truncate">{result.title}</TableCell>
                      <TableCell className="tabular-nums">
                        {result.percentage === null ? '—' : formatPercent(result.percentage)}
                      </TableCell>
                      <TableCell>
                        {result.passed === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <Badge variant={result.passed ? 'success' : 'destructive'}>
                            {result.passed ? 'Pass' : 'Fail'}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export { TraineeAssessmentOverview };
