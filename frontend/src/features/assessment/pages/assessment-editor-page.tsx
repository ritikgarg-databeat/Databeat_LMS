// Mirrors classroom/pages/course-editor-page.tsx's detail/editor layout almost exactly — header
// actions dropdown, an info card, and a reorderable child-item list (questions instead of
// modules/lessons) with an "Add" button. See that file for the precedent this was built against.
import { isAxiosError } from 'axios';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { ConfirmDialog, ErrorScreen } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/utils/date';
import { getErrorMessage } from '@/utils/error';

import { AddQuestionToAssessmentDialog } from '../components/add-question-to-assessment-dialog';
import { AssessmentQuestionList } from '../components/assessment-question-list';
import { AssessmentStatusBadge } from '../components/assessment-status-badge';
import { AssignAssessmentGroupsDialog } from '../components/assign-assessment-groups-dialog';
import { EditAssessmentDialog } from '../components/edit-assessment-dialog';
import { useAssessmentQuery, useDeleteAssessmentMutation, useUpdateAssessmentStatusMutation } from '../hooks';
import type { AssessmentStatus } from '../types';

/** Target status → the label used for both the triggering menu item and the confirm dialog. */
const STATUS_ACTION_LABEL: Record<AssessmentStatus, string> = {
  DRAFT: 'Unpublish',
  PUBLISHED: 'Publish',
  ARCHIVED: 'Archive',
};

const STATUS_CONFIRM_DESCRIPTION: Record<AssessmentStatus, string> = {
  DRAFT: 'will move back to draft and become hidden from trainees.',
  PUBLISHED: 'will be published and become visible to its assigned groups.',
  ARCHIVED: 'will be archived and hidden from active lists.',
};

const STATUS_SUCCESS_MESSAGE: Record<AssessmentStatus, string> = {
  DRAFT: 'moved back to draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
};

function AssessmentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAdminRoute = useLocation().pathname.startsWith('/admin');
  const basePath = isAdminRoute ? '/admin' : '/trainer';
  const assessmentsListPath = `${basePath}/assessments`;

  const [addQuestionOpen, setAddQuestionOpen] = useState(false);
  const [editAssessmentOpen, setEditAssessmentOpen] = useState(false);
  const [assignGroupsOpen, setAssignGroupsOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<AssessmentStatus | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data: assessment, isLoading, isError, error, refetch } = useAssessmentQuery(id);
  const updateStatus = useUpdateAssessmentStatusMutation();
  const deleteAssessment = useDeleteAssessmentMutation();

  if (!id) return null;

  if (isError) {
    const httpStatus = isAxiosError(error) ? error.response?.status : undefined;
    if (httpStatus === 403) {
      return <ErrorScreen title="Access denied" message="You do not have access to this assessment." />;
    }
    if (httpStatus === 404) {
      return <ErrorScreen title="Assessment not found" message="This assessment may have been deleted." />;
    }
    return <ErrorScreen message="Failed to load this assessment." onRetry={() => void refetch()} />;
  }

  if (isLoading || !assessment) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const handleUpdateStatus = async () => {
    if (!pendingStatus) return;
    try {
      await updateStatus.mutateAsync({ id: assessment.id, payload: { status: pendingStatus } });
      // Mirrors course-editor-page.tsx: the mutation's own invalidation is fire-and-forget, so
      // an explicit refetch guarantees the header badge is current before this dialog closes.
      await refetch();
      toast.success(`${assessment.title} ${STATUS_SUCCESS_MESSAGE[pendingStatus]}.`);
    } catch (updateError) {
      toast.error(getErrorMessage(updateError));
    } finally {
      setPendingStatus(null);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAssessment.mutateAsync(assessment.id);
      toast.success(`${assessment.title} deleted.`);
      navigate(assessmentsListPath);
    } catch (deleteError) {
      toast.error(getErrorMessage(deleteError));
      setDeleteConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{assessment.title}</h1>
            <AssessmentStatusBadge status={assessment.status} />
          </div>
          {assessment.description ? (
            <p className="max-w-2xl text-muted-foreground">{assessment.description}</p>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Actions <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditAssessmentOpen(true)}>Edit Assessment Details</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAssignGroupsOpen(true)}>Assign to Groups</DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`${basePath}/assessments/${assessment.id}/results`}>View Results</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {assessment.status === 'DRAFT' ? (
              <>
                <DropdownMenuItem onClick={() => setPendingStatus('PUBLISHED')}>Publish</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPendingStatus('ARCHIVED')}>Archive</DropdownMenuItem>
              </>
            ) : null}
            {assessment.status === 'PUBLISHED' ? (
              <>
                <DropdownMenuItem onClick={() => setPendingStatus('DRAFT')}>Unpublish</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPendingStatus('ARCHIVED')}>Archive</DropdownMenuItem>
              </>
            ) : null}
            {assessment.status === 'ARCHIVED' ? (
              <DropdownMenuItem onClick={() => setPendingStatus('DRAFT')}>Restore to Draft</DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assessment details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Duration</p>
            <p className="text-sm">{assessment.durationMinutes} min</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Passing percentage</p>
            <p className="text-sm">{assessment.passingPercentage}%</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Available from</p>
            <p className="text-sm">{assessment.availableFrom ? formatDateTime(assessment.availableFrom) : '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Due date</p>
            <p className="text-sm">{assessment.dueDate ? formatDateTime(assessment.dueDate) : '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Negative marking</p>
            <p className="text-sm">
              {assessment.negativeMarkingEnabled
                ? `Enabled — ${assessment.negativeMarksPerWrongAnswer} mark(s) per wrong answer`
                : 'Disabled'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Randomize questions</p>
            <p className="text-sm">{assessment.randomizeQuestions ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Show result immediately</p>
            <p className="text-sm">{assessment.showResultImmediately ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Questions</p>
            <p className="text-sm">{assessment.questionCount}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Max marks</p>
            <p className="text-sm">{assessment.maxMarks}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Created by</p>
            <p className="text-sm">
              {assessment.createdBy ? `${assessment.createdBy.firstName} ${assessment.createdBy.lastName}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Assigned groups</p>
            <p className="text-sm">
              {assessment.assignedGroups.length}{' '}
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => setAssignGroupsOpen(true)}
              >
                Manage
              </button>
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Questions</h2>
          <Button onClick={() => setAddQuestionOpen(true)}>
            <Plus /> Add Question
          </Button>
        </div>

        <AssessmentQuestionList assessmentId={assessment.id} />
      </div>

      <AddQuestionToAssessmentDialog
        assessmentId={assessment.id}
        open={addQuestionOpen}
        onOpenChange={setAddQuestionOpen}
      />

      <EditAssessmentDialog
        assessment={editAssessmentOpen ? assessment : null}
        onOpenChange={setEditAssessmentOpen}
      />

      <AssignAssessmentGroupsDialog
        assessmentId={assessment.id}
        open={assignGroupsOpen}
        onOpenChange={setAssignGroupsOpen}
      />

      <ConfirmDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => !open && setPendingStatus(null)}
        title={pendingStatus ? `${STATUS_ACTION_LABEL[pendingStatus]} assessment` : ''}
        description={pendingStatus ? `${assessment.title} ${STATUS_CONFIRM_DESCRIPTION[pendingStatus]}` : undefined}
        confirmLabel={pendingStatus ? STATUS_ACTION_LABEL[pendingStatus] : 'Confirm'}
        destructive={pendingStatus === 'ARCHIVED'}
        onConfirm={() => void handleUpdateStatus()}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete assessment"
        description={`${assessment.title} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

export { AssessmentEditorPage };
