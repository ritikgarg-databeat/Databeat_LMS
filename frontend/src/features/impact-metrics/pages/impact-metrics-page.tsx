// Trainer/Super-Admin reporting page over real usage logs — Tasks 2-4 of the Measurable Early
// Impact instrumentation (usage-log-derived latency reports, the pilot cohort dashboard, and the
// Impact Report generator). Every number here comes from a live query; nothing is cached,
// projected, or precomputed at build time.
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { EmptyState } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { groupsApi } from '@/features/groups/services';
import { formatMs } from '@/utils/duration';

import {
  useAiQuizGenLatencyQuery,
  useAutoGradingLatencyQuery,
  useCsvImportSpeedQuery,
  useImpactReportQuery,
  usePilotDashboardQuery,
} from '../hooks';
import type { ImpactConfidence, UsageMetricReport } from '../types';

const OPTIONS_PAGE_SIZE = 100;

const CONFIDENCE_BADGE: Record<ImpactConfidence, { label: string; variant: 'success' | 'warning' | 'secondary' }> = {
  validated: { label: 'Validated', variant: 'success' },
  measured: { label: 'Measured', variant: 'warning' },
  insufficient: { label: 'Insufficient data', variant: 'secondary' },
};

function UsageMetricCard({ title, query }: { title: string; query: ReturnType<typeof useAutoGradingLatencyQuery> }) {
  const report = query.data as UsageMetricReport | undefined;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : !report || report.n === 0 ? (
          <p className="text-sm text-muted-foreground">insufficient data — not yet measured</p>
        ) : (
          <div className="space-y-1">
            <p className="text-xl font-semibold tabular-nums">{formatMs(report.meanMs ?? 0)} mean</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              median {formatMs(report.medianMs ?? 0)}, range {formatMs(report.minMs ?? 0)}–{formatMs(report.maxMs ?? 0)}
            </p>
            <div className="text-xs text-muted-foreground">
              n = {report.n}
              {report.dateRangeFrom && report.dateRangeTo
                ? ` (${report.dateRangeFrom.slice(0, 10)} to ${report.dateRangeTo.slice(0, 10)})`
                : ''}
              {report.lowSampleWarning ? (
                <Badge variant="warning" className="ml-2">
                  Low sample size
                </Badge>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ImpactMetricsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [groupId, setGroupId] = useState('');
  const [reportRequested, setReportRequested] = useState(false);

  const dateFilters = { from: from || undefined, to: to || undefined };

  const groupsQuery = useQuery({
    queryKey: ['impact-metrics-group-options'],
    queryFn: () => groupsApi.list({ page: 1, pageSize: OPTIONS_PAGE_SIZE }),
  });

  const autoGradingQuery = useAutoGradingLatencyQuery(dateFilters);
  const aiQuizGenQuery = useAiQuizGenLatencyQuery(dateFilters);
  const csvImportQuery = useCsvImportSpeedQuery(dateFilters);

  const pilotDashboardQuery = usePilotDashboardQuery(groupId ? { groupId, ...dateFilters } : null);
  const pilotDashboardRangeSuffix =
    pilotDashboardQuery.data?.dateRangeFrom && pilotDashboardQuery.data.dateRangeTo
      ? ` (${pilotDashboardQuery.data.dateRangeFrom.slice(0, 10)} to ${pilotDashboardQuery.data.dateRangeTo.slice(0, 10)})`
      : '';

  const impactReportParams = { ...dateFilters, groupId: groupId || undefined };
  const impactReportQuery = useImpactReportQuery(impactReportParams, reportRequested);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Impact Metrics</h1>
        <p className="text-muted-foreground">
          Real usage-log-derived numbers, a pilot cohort dashboard, and the Impact Report generator — every figure
          labeled by how much confidence it has actually earned.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input id="from" type="date" className="w-40" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input id="to" type="date" className="w-40" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <p className="pb-2 text-xs text-muted-foreground">Leave blank for all-time. Applies to every section below.</p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Usage-derived metrics</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <UsageMetricCard title="Auto-grading turnaround" query={autoGradingQuery} />
          <UsageMetricCard title="AI quiz generation latency" query={aiQuizGenQuery} />
          <UsageMetricCard title="Bulk CSV import speed" query={csvImportQuery} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">Pilot cohort dashboard</h2>
        <div className="mb-3 max-w-xs space-y-1">
          <Label htmlFor="groupId" className="text-xs text-muted-foreground">
            Group
          </Label>
          <Select value={groupId || 'none'} onValueChange={(value) => setGroupId(value === 'none' ? '' : value)}>
            <SelectTrigger id="groupId">
              <SelectValue placeholder="Select a group..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select a group...</SelectItem>
              {(groupsQuery.data?.items ?? []).map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!groupId ? (
          <EmptyState title="Select a group" description="Choose a group to load its pilot dashboard." />
        ) : pilotDashboardQuery.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : pilotDashboardQuery.data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quiz-gate compliance</CardTitle>
              </CardHeader>
              <CardContent>
                {pilotDashboardQuery.data.gateCompliance.n === 0 ? (
                  <p className="text-sm text-muted-foreground">insufficient data — not yet measured</p>
                ) : (
                  <>
                    <p className="text-xl font-semibold tabular-nums">
                      {pilotDashboardQuery.data.gateCompliance.percentGated?.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      n = {pilotDashboardQuery.data.gateCompliance.n} gated completions
                      {pilotDashboardRangeSuffix}
                    </p>
                    {pilotDashboardQuery.data.gateCompliance.exceptions.length > 0 ? (
                      <Badge variant="destructive" className="mt-1">
                        {pilotDashboardQuery.data.gateCompliance.exceptions.length} exception(s) — bug flagged
                      </Badge>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quiz performance</CardTitle>
              </CardHeader>
              <CardContent>
                {pilotDashboardQuery.data.quizPerformance.n === 0 ? (
                  <p className="text-sm text-muted-foreground">insufficient data — not yet measured</p>
                ) : (
                  <>
                    <p className="text-xl font-semibold tabular-nums">
                      {pilotDashboardQuery.data.quizPerformance.averagePercentage?.toFixed(1)}% avg
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      range {pilotDashboardQuery.data.quizPerformance.minPercentage}%–
                      {pilotDashboardQuery.data.quizPerformance.maxPercentage}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      n = {pilotDashboardQuery.data.quizPerformance.n} submitted quizzes
                      {pilotDashboardRangeSuffix}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Manual grading turnaround</CardTitle>
              </CardHeader>
              <CardContent>
                {pilotDashboardQuery.data.manualGradingTurnaround.n === 0 ? (
                  <p className="text-sm text-muted-foreground">insufficient data — not yet measured</p>
                ) : (
                  <>
                    <p className="text-xl font-semibold tabular-nums">
                      {formatMs(pilotDashboardQuery.data.manualGradingTurnaround.meanMs ?? 0)} mean
                    </p>
                    <p className="text-xs text-muted-foreground">
                      n = {pilotDashboardQuery.data.manualGradingTurnaround.n} graded answers
                      {pilotDashboardRangeSuffix}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Weekly active</CardTitle>
              </CardHeader>
              <CardContent>
                {pilotDashboardQuery.data.weeklyActive.totalMembers === 0 ? (
                  <p className="text-sm text-muted-foreground">insufficient data — not yet measured</p>
                ) : (
                  <>
                    <p className="text-xl font-semibold tabular-nums">
                      {pilotDashboardQuery.data.weeklyActive.percent?.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pilotDashboardQuery.data.weeklyActive.activeCount} of {pilotDashboardQuery.data.weeklyActive.totalMembers} members,
                      trailing 7 days
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Impact Report</h2>
          <Button
            onClick={() => {
              setReportRequested(true);
              void impactReportQuery.refetch();
            }}
            disabled={impactReportQuery.isFetching}
          >
            {impactReportQuery.isFetching ? 'Generating...' : 'Generate report'}
          </Button>
        </div>

        {!reportRequested ? (
          <EmptyState title="No report generated yet" description="Click 'Generate report' to assemble one from current live data." />
        ) : impactReportQuery.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : impactReportQuery.data ? (
          <div className="space-y-3">
            {impactReportQuery.data.sections.map((section) => {
              const badge = CONFIDENCE_BADGE[section.confidence];
              return (
                <Card key={section.key}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{section.label}</CardTitle>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{section.summary}</p>
                  </CardContent>
                </Card>
              );
            })}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Raw report (markdown)</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs">
                  {impactReportQuery.data.markdown}
                </pre>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { ImpactMetricsPage };
