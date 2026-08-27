import {
  Activity,
  Award,
  BookOpenCheck,
  Clock,
  RefreshCw,
  ShieldCheck,
  IndianRupee,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { ErrorScreen, StatCard } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAssessmentsQuery } from '@/features/assessment/hooks';
import { useCoursesQuery } from '@/features/classroom/hooks';
import { useActiveDepartmentsOptions, useGroupsQuery } from '@/features/groups/hooks';
import { formatRelativeTime } from '@/utils/date';

import {
  AnalyticsBarChart,
  AnalyticsLineChart,
  AnalyticsPieChart,
  ChartCard,
  formatPercent,
} from '../components';
import { useLiveAnalyticsQuery } from '../hooks';
import type { LiveAnalyticsParams } from '../types';

const OPTIONS_PAGE_SIZE = 100;
const ANNUAL_LMS_COST_PER_EMPLOYEE = 3000;

function formatInr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function LiveAnalysisPage() {
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
  const [departmentId, setDepartmentId] = useState('all');
  const [groupId, setGroupId] = useState('all');
  const [courseId, setCourseId] = useState('all');
  const [assessmentId, setAssessmentId] = useState('all');
  const isAdmin = useLocation().pathname.startsWith('/admin');
  const basePath = isAdmin ? '/admin' : '/trainer';
  const params: LiveAnalyticsParams = useMemo(
    () => ({
      rangeDays,
      departmentId: departmentId === 'all' ? undefined : departmentId,
      groupId: groupId === 'all' ? undefined : groupId,
      courseId: courseId === 'all' ? undefined : courseId,
      assessmentId: assessmentId === 'all' ? undefined : assessmentId,
    }),
    [assessmentId, courseId, departmentId, groupId, rangeDays],
  );
  const query = useLiveAnalyticsQuery(params);
  const { data: departments } = useActiveDepartmentsOptions();
  const { data: groups } = useGroupsQuery({ page: 1, pageSize: OPTIONS_PAGE_SIZE });
  const { data: courses } = useCoursesQuery({ page: 1, pageSize: OPTIONS_PAGE_SIZE });
  const { data: assessments } = useAssessmentsQuery({ page: 1, pageSize: OPTIONS_PAGE_SIZE });

  if (query.isError) {
    return <ErrorScreen message="Failed to load live analysis." onRetry={() => void query.refetch()} />;
  }

  const data = query.data;
  const timeline = data?.activityTimeline.map((point) => ({ ...point, label: point.date.slice(5) })) ?? [];
  const courseChart = (data?.courses ?? []).slice(0, 12).map((course) => ({
    name: course.title.length > 18 ? `${course.title.slice(0, 18)}...` : course.title,
    completionRate: course.completionRate,
  }));
  const groupChart = (data?.groups ?? []).slice(0, 12).map((group) => ({
    name: group.name.length > 18 ? `${group.name.slice(0, 18)}...` : group.name,
    completion: group.completionPercentage,
    score: group.averageScore ?? 0,
  }));
  const assessmentChart = (data?.assessments ?? []).slice(0, 12).map((assessment) => ({
    name: assessment.title.length > 18 ? `${assessment.title.slice(0, 18)}...` : assessment.title,
    participation: assessment.participationRate,
    passRate: assessment.passRate ?? 0,
  }));
  const mandatoryChart = (data?.mandatoryCompliance ?? []).slice(0, 12).map((course) => ({
    name: course.title.length > 18 ? `${course.title.slice(0, 18)}...` : course.title,
    completed: course.completed,
    inProgress: course.inProgress,
    notStarted: course.notStarted,
  }));
  const integrityChart = (data?.integrityEvents ?? []).map((event) => ({
    name: event.type.toLowerCase().replaceAll('_', ' '),
    count: event.count,
  }));
  const adoptionRate = data?.summary.totalTrainees
    ? Math.round((data.summary.activeTrainees / data.summary.totalTrainees) * 100)
    : 0;
  const potentialAnnualAvoidance = (data?.summary.totalTrainees ?? 0) * ANNUAL_LMS_COST_PER_EMPLOYEE;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isAdmin ? 'Executive Learning Analysis' : 'Team Performance'}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin
              ? 'Organization-wide workforce capability, adoption, compliance, and assessment outcomes.'
              : 'Manager view of learners in your active groups and assigned courses.'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            {data ? `Updated ${new Date(data.generatedAt).toLocaleTimeString()}` : 'Loading current data...'}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={query.isFetching ? 'animate-spin' : undefined} /> Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <Filter
            value={String(rangeDays)}
            onChange={(value) => setRangeDays(Number(value) as 7 | 30 | 90)}
            label="Period"
          >
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </Filter>
          <Filter value={departmentId} onChange={setDepartmentId} label="Department">
            <SelectItem value="all">All departments</SelectItem>
            {departments?.map((department) => (
              <SelectItem key={department.id} value={department.id}>
                {department.name}
              </SelectItem>
            ))}
          </Filter>
          <Filter value={groupId} onChange={setGroupId} label="Group">
            <SelectItem value="all">All groups</SelectItem>
            {groups?.items.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </Filter>
          <Filter value={courseId} onChange={setCourseId} label="Course">
            <SelectItem value="all">All courses</SelectItem>
            {courses?.items.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.title}
              </SelectItem>
            ))}
          </Filter>
          <Filter value={assessmentId} onChange={setAssessmentId} label="Assessment">
            <SelectItem value="all">All assessments</SelectItem>
            {assessments?.items.map((assessment) => (
              <SelectItem key={assessment.id} value={assessment.id}>
                {assessment.title}
              </SelectItem>
            ))}
          </Filter>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isAdmin ? 'Executive impact snapshot' : 'Team business impact'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ImpactMetric icon={Users} label="Workforce reach" value={data?.summary.totalTrainees ?? 0} />
            <ImpactMetric icon={Target} label="Active learner adoption" value={`${adoptionRate}%`} />
            <ImpactMetric
              icon={IndianRupee}
              label="Potential annual LMS saving"
              value={formatInr(potentialAnnualAvoidance)}
            />
            <ImpactMetric
              icon={ShieldCheck}
              label="Mandatory compliance"
              value={formatPercent(data?.summary.mandatoryCompletion ?? 0)}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Financial estimate uses a configurable business benchmark of ₹3,000 per learner/year; validate
              it in Impact Metrics before external reporting.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to={`${basePath}/classroom`}>Open courses</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to={`${basePath}/reports`}>Export evidence</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to={`${basePath}/impact-metrics`}>Validate ROI</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Learners in scope" value={data?.summary.totalTrainees ?? 0} icon={Users} />
        <StatCard label="Engaged in period" value={data?.summary.activeTrainees ?? 0} icon={Activity} />
        <StatCard label="Learning delivered (hours)" value={data?.summary.learningHours ?? 0} icon={Clock} />
        <StatCard
          label="Workforce completion"
          value={formatPercent(data?.summary.averageCompletion ?? 0)}
          icon={TrendingUp}
        />
        <StatCard
          label="Average capability score"
          value={data?.summary.averageScore == null ? '-' : formatPercent(data.summary.averageScore)}
          icon={Award}
        />
        <StatCard
          label="Assessment pass rate"
          value={data?.summary.passRate == null ? '-' : formatPercent(data.summary.passRate)}
          icon={BookOpenCheck}
        />
        <StatCard
          label="Mandatory compliance"
          value={formatPercent(data?.summary.mandatoryCompletion ?? 0)}
          icon={ShieldCheck}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Learning activity"
          description={`Last ${rangeDays} days`}
          isLoading={query.isLoading}
          tableView={{
            headers: ['Date', 'Lessons', 'Assessments', 'Logins', 'AI messages'],
            rows: timeline.map((point) => [
              point.date,
              point.lessonsCompleted,
              point.assessmentsSubmitted,
              point.logins,
              point.aiMessages,
            ]),
          }}
        >
          <AnalyticsLineChart
            data={timeline}
            xKey="label"
            series={[
              { key: 'lessonsCompleted', label: 'Lessons', slot: 1 },
              { key: 'assessmentsSubmitted', label: 'Assessments', slot: 2 },
              { key: 'logins', label: 'Logins', slot: 3 },
            ]}
          />
        </ChartCard>
        <ChartCard
          title="Learner completion status"
          isLoading={query.isLoading}
          tableView={{
            headers: ['Status', 'Trainees'],
            rows: (data?.completionDistribution ?? []).map((item) => [
              item.status.replace('_', ' '),
              item.count,
            ]),
          }}
        >
          <AnalyticsPieChart
            data={(data?.completionDistribution ?? []).map((item) => ({
              name: item.status.replace('_', ' '),
              value: item.count,
            }))}
            centerLabel="trainees"
          />
        </ChartCard>
        <ChartCard
          title="Course completion"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to={`${basePath}/classroom`}>Drill down</Link>
            </Button>
          }
          isLoading={query.isLoading}
          tableView={{
            headers: ['Course', 'Completion'],
            rows: courseChart.map((row) => [row.name, `${row.completionRate}%`]),
          }}
        >
          <AnalyticsBarChart
            data={courseChart}
            xKey="name"
            series={[{ key: 'completionRate', label: 'Completion', slot: 1 }]}
            yDomain={[0, 100]}
          />
        </ChartCard>
        <ChartCard
          title="Group performance"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to={`${basePath}/groups`}>Drill down</Link>
            </Button>
          }
          isLoading={query.isLoading}
          tableView={{
            headers: ['Group', 'Completion', 'Score'],
            rows: groupChart.map((row) => [row.name, `${row.completion}%`, `${row.score}%`]),
          }}
        >
          <AnalyticsBarChart
            data={groupChart}
            xKey="name"
            series={[
              { key: 'completion', label: 'Completion', slot: 1 },
              { key: 'score', label: 'Score', slot: 2 },
            ]}
            yDomain={[0, 100]}
          />
        </ChartCard>
        <ChartCard
          title="Assessment performance"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to={`${basePath}/assessments`}>Drill down</Link>
            </Button>
          }
          isLoading={query.isLoading}
          tableView={{
            headers: ['Assessment', 'Participation', 'Pass rate'],
            rows: assessmentChart.map((row) => [row.name, `${row.participation}%`, `${row.passRate}%`]),
          }}
        >
          <AnalyticsBarChart
            data={assessmentChart}
            xKey="name"
            series={[
              { key: 'participation', label: 'Participation', slot: 1 },
              { key: 'passRate', label: 'Pass rate', slot: 2 },
            ]}
            yDomain={[0, 100]}
          />
        </ChartCard>
        <ChartCard
          title="Mandatory training compliance"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to={`${basePath}/reports`}>Export</Link>
            </Button>
          }
          isLoading={query.isLoading}
          tableView={{
            headers: ['Course', 'Completed', 'In progress', 'Not started'],
            rows: mandatoryChart.map((row) => [row.name, row.completed, row.inProgress, row.notStarted]),
          }}
        >
          <AnalyticsBarChart
            data={mandatoryChart}
            xKey="name"
            series={[
              { key: 'completed', label: 'Completed', slot: 1 },
              { key: 'inProgress', label: 'In progress', slot: 2 },
              { key: 'notStarted', label: 'Not started', slot: 3 },
            ]}
          />
        </ChartCard>
        <ChartCard
          title="Assessment integrity events"
          description={`Last ${rangeDays} days`}
          isLoading={query.isLoading}
          tableView={{
            headers: ['Event', 'Count'],
            rows: integrityChart.map((row) => [row.name, row.count]),
          }}
        >
          <AnalyticsBarChart
            data={integrityChart}
            xKey="name"
            series={[{ key: 'count', label: 'Events', slot: 4 }]}
          />
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AnalyticsTable
          title="Top-performing employees"
          headers={['Learner', 'Completion', 'Score']}
          rows={(data?.leaderboard ?? []).map((item) => [
            <Link
              key={item.userId}
              className="font-medium hover:underline"
              to={`${basePath}/users/${item.userId}/analytics`}
            >
              {item.rank}. {item.name}
            </Link>,
            formatPercent(item.completionPercentage),
            item.averageScore == null ? '-' : formatPercent(item.averageScore),
          ])}
        />
        <AnalyticsTable
          title="Employees needing attention"
          headers={['Learner', 'Completion', 'Last activity']}
          rows={(data?.atRiskTrainees ?? []).map((item) => [
            <Link
              key={item.userId}
              className="font-medium hover:underline"
              to={`${basePath}/users/${item.userId}/analytics`}
            >
              {item.name}
            </Link>,
            formatPercent(item.completionPercentage),
            item.lastActivityAt ? formatRelativeTime(item.lastActivityAt) : 'Never',
          ])}
        />
      </div>
    </div>
  );
}

function ImpactMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}

function Filter({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-44" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

function AnalyticsTable({ title, headers, rows }: { title: string; headers: string[]; rows: ReactNode[][] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row, index) => (
                <TableRow key={index}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={cellIndex}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={headers.length} className="text-center text-muted-foreground">
                  No data for this selection.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export { LiveAnalysisPage };
