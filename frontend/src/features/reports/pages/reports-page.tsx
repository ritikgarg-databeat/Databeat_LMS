import { BookOpen, ClipboardCheck, Download, Layers, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useAssessmentsQuery } from '@/features/assessment/hooks';
import { useCoursesQuery } from '@/features/classroom/hooks';
import { useGroupsQuery } from '@/features/groups/hooks';

import { FilterDropdown } from '../components/filter-dropdown';
import type { FilterDropdownOption } from '../components/filter-dropdown';
import { useDownloadReportMutation } from '../hooks';

/** Big enough to cover a trainer's whole assigned scope in one page for the filter dropdowns. */
const OPTIONS_PAGE_SIZE = 100;

function useGroupOptions(): FilterDropdownOption[] {
  const { data } = useGroupsQuery({ page: 1, pageSize: OPTIONS_PAGE_SIZE });
  return [
    { value: '', label: 'All groups' },
    ...(data?.items.map((group) => ({ value: group.id, label: `${group.name} (${group.code})` })) ?? []),
  ];
}

function useCourseOptions(): FilterDropdownOption[] {
  const { data } = useCoursesQuery({ page: 1, pageSize: OPTIONS_PAGE_SIZE });
  return [
    { value: '', label: 'All courses' },
    ...(data?.items.map((course) => ({ value: course.id, label: course.title })) ?? []),
  ];
}

function useAssessmentOptions(): FilterDropdownOption[] {
  const { data } = useAssessmentsQuery({ page: 1, pageSize: OPTIONS_PAGE_SIZE });
  return [
    { value: '', label: 'All assessments' },
    ...(data?.items.map((assessment) => ({ value: assessment.id, label: assessment.title })) ?? []),
  ];
}

interface ReportCardShellProps {
  icon: LucideIcon;
  title: string;
  description: string;
  filters?: React.ReactNode;
  isPending: boolean;
  onDownload: () => void;
}

/** Shared card chrome for the four export cards — icon/title/description/filters/download button. */
function ReportCardShell({ icon: Icon, title, description, filters, isPending, onDownload }: ReportCardShellProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-5 text-muted-foreground" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1.5">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {filters ? <div className="flex flex-wrap gap-2">{filters}</div> : null}
        <Button type="button" onClick={onDownload} disabled={isPending} className="w-full sm:w-auto">
          {isPending ? <Spinner size="sm" className="text-current" /> : <Download aria-hidden />}
          Download CSV
        </Button>
      </CardContent>
    </Card>
  );
}

function UserProgressReportCard({
  groupOptions,
  courseOptions,
}: {
  groupOptions: FilterDropdownOption[];
  courseOptions: FilterDropdownOption[];
}) {
  const [groupId, setGroupId] = useState('');
  const [courseId, setCourseId] = useState('');
  const { mutate, isPending } = useDownloadReportMutation();

  return (
    <ReportCardShell
      icon={TrendingUp}
      title="User Progress"
      description="Per-trainee course completion and time spent."
      isPending={isPending}
      filters={
        <>
          <FilterDropdown label="Group" options={groupOptions} value={groupId} onChange={setGroupId} />
          <FilterDropdown label="Course" options={courseOptions} value={courseId} onChange={setCourseId} />
        </>
      }
      onDownload={() =>
        mutate(
          {
            kind: 'progress',
            params: { groupId: groupId || undefined, courseId: courseId || undefined },
          },
          { onSuccess: () => toast.success('Report downloaded') },
        )
      }
    />
  );
}

function AssessmentResultsReportCard({
  assessmentOptions,
  groupOptions,
}: {
  assessmentOptions: FilterDropdownOption[];
  groupOptions: FilterDropdownOption[];
}) {
  const [assessmentId, setAssessmentId] = useState('');
  const [groupId, setGroupId] = useState('');
  const { mutate, isPending } = useDownloadReportMutation();

  return (
    <ReportCardShell
      icon={ClipboardCheck}
      title="Assessment Results"
      description="Per-attempt scores, pass/fail, and submission dates."
      isPending={isPending}
      filters={
        <>
          <FilterDropdown
            label="Assessment"
            options={assessmentOptions}
            value={assessmentId}
            onChange={setAssessmentId}
          />
          <FilterDropdown label="Group" options={groupOptions} value={groupId} onChange={setGroupId} />
        </>
      }
      onDownload={() =>
        mutate(
          {
            kind: 'results',
            params: { assessmentId: assessmentId || undefined, groupId: groupId || undefined },
          },
          { onSuccess: () => toast.success('Report downloaded') },
        )
      }
    />
  );
}

function GroupPerformanceReportCard() {
  const { mutate, isPending } = useDownloadReportMutation();

  return (
    <ReportCardShell
      icon={Layers}
      title="Group Performance"
      description="Completion, average score, and activity rolled up per group."
      isPending={isPending}
      onDownload={() => mutate({ kind: 'groups' }, { onSuccess: () => toast.success('Report downloaded') })}
    />
  );
}

function CourseCompletionReportCard() {
  const { mutate, isPending } = useDownloadReportMutation();

  return (
    <ReportCardShell
      icon={BookOpen}
      title="Course Completion"
      description="Enrollment, completion rate, and average score per course."
      isPending={isPending}
      onDownload={() => mutate({ kind: 'courses' }, { onSuccess: () => toast.success('Report downloaded') })}
    />
  );
}

/** Reports page (Prompt 8) — four CSV exports, mounted later at `/trainer/reports`. */
function ReportsPage() {
  const groupOptions = useGroupOptions();
  const courseOptions = useCourseOptions();
  const assessmentOptions = useAssessmentOptions();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">Export CSV reports for offline analysis.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <UserProgressReportCard groupOptions={groupOptions} courseOptions={courseOptions} />
        <AssessmentResultsReportCard assessmentOptions={assessmentOptions} groupOptions={groupOptions} />
        <GroupPerformanceReportCard />
        <CourseCompletionReportCard />
      </div>

      <p className="text-sm text-muted-foreground">
        Exports respect your group assignments — you only see trainees in groups assigned to you.
      </p>
    </div>
  );
}

export { ReportsPage };
