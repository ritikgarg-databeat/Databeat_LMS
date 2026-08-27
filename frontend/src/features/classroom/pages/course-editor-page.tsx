import { isAxiosError } from 'axios';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { ConfirmDialog, ErrorScreen } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
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
import { getErrorMessage } from '@/utils/error';

import { AssignGroupsDialog } from '../components/assign-groups-dialog';
import { CourseStatusBadge } from '../components/course-status-badge';
import { CreateModuleDialog } from '../components/create-module-dialog';
import { DifficultyBadge } from '../components/difficulty-badge';
import { EditCourseDialog } from '../components/edit-course-dialog';
import { ModuleLessonTree } from '../components/module-lesson-tree';
import { useCourseQuery, useDeleteCourseMutation, useUpdateCourseStatusMutation } from '../hooks';
import type { CourseStatus } from '../types';

/** Target status → the label used for both the triggering menu item and the confirm dialog. */
const STATUS_ACTION_LABEL: Record<CourseStatus, string> = {
  DRAFT: 'Unpublish',
  PUBLISHED: 'Publish',
  ARCHIVED: 'Archive',
};

const STATUS_CONFIRM_DESCRIPTION: Record<CourseStatus, string> = {
  DRAFT: 'will move back to draft and become hidden from trainees.',
  PUBLISHED: 'will be published and become visible to its assigned groups.',
  ARCHIVED: 'will be archived and hidden from active lists.',
};

const STATUS_SUCCESS_MESSAGE: Record<CourseStatus, string> = {
  DRAFT: 'moved back to draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
};

function CourseEditorPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const isAdminRoute = useLocation().pathname.startsWith('/admin');
  const coursesListPath = isAdminRoute ? '/admin/classroom' : '/trainer/classroom';

  const [createModuleOpen, setCreateModuleOpen] = useState(false);
  const [editCourseOpen, setEditCourseOpen] = useState(false);
  const [assignGroupsOpen, setAssignGroupsOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<CourseStatus | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data: course, isLoading, isError, error, refetch } = useCourseQuery(courseId);
  const updateStatus = useUpdateCourseStatusMutation();
  const deleteCourse = useDeleteCourseMutation();

  if (!courseId) return null;

  if (isError) {
    const httpStatus = isAxiosError(error) ? error.response?.status : undefined;
    if (httpStatus === 403) {
      return <ErrorScreen title="Access denied" message="You do not have access to this course." />;
    }
    if (httpStatus === 404) {
      return <ErrorScreen title="Course not found" message="This course may have been deleted." />;
    }
    return <ErrorScreen message="Failed to load this course." onRetry={() => void refetch()} />;
  }

  if (isLoading || !course) {
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
      await updateStatus.mutateAsync({ id: course.id, payload: { status: pendingStatus } });
      // Mirrors group-details-page.tsx: the mutation's own invalidation is fire-and-forget, so
      // an explicit refetch guarantees the header badge is current before this dialog closes.
      await refetch();
      toast.success(`${course.title} ${STATUS_SUCCESS_MESSAGE[pendingStatus]}.`);
    } catch (updateError) {
      toast.error(getErrorMessage(updateError));
    } finally {
      setPendingStatus(null);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCourse.mutateAsync(course.id);
      toast.success(`${course.title} deleted.`);
      navigate(coursesListPath);
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
            <h1 className="text-2xl font-semibold tracking-tight">{course.title}</h1>
            <CourseStatusBadge status={course.status} />
            <DifficultyBadge difficulty={course.difficulty} />
            {course.isMandatory && course.canEdit ? (
              <Badge variant="outline">Mandatory by default</Badge>
            ) : null}
          </div>
          {course.description ? (
            <p className="max-w-2xl text-muted-foreground">{course.description}</p>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Actions <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {course.canEdit ? (
              <DropdownMenuItem onClick={() => setEditCourseOpen(true)}>Edit Course Details</DropdownMenuItem>
            ) : null}
            {course.canAssign ? (
              <DropdownMenuItem onClick={() => setAssignGroupsOpen(true)}>Assign to Groups</DropdownMenuItem>
            ) : null}
            {course.canEdit ? (
              <DropdownMenuItem onClick={() => navigate(`${coursesListPath}/${courseId}/analytics`)}>
                View Analytics
              </DropdownMenuItem>
            ) : null}
            {course.canEdit ? <DropdownMenuSeparator /> : null}
            {course.canEdit && course.status === 'DRAFT' ? (
              <>
                <DropdownMenuItem onClick={() => setPendingStatus('PUBLISHED')}>Publish</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPendingStatus('ARCHIVED')}>Archive</DropdownMenuItem>
              </>
            ) : null}
            {course.canEdit && course.status === 'PUBLISHED' ? (
              <>
                <DropdownMenuItem onClick={() => setPendingStatus('DRAFT')}>Unpublish</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPendingStatus('ARCHIVED')}>Archive</DropdownMenuItem>
              </>
            ) : null}
            {course.canEdit && course.status === 'ARCHIVED' ? (
              <DropdownMenuItem onClick={() => setPendingStatus('DRAFT')}>Restore to Draft</DropdownMenuItem>
            ) : null}
            {course.canEdit ? <DropdownMenuSeparator /> : null}
            {course.canEdit ? (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                Delete
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Course details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Department</p>
            <p className="text-sm">{course.department?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Experience level</p>
            <p className="text-sm">{course.experienceLevel?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Estimated duration</p>
            <p className="text-sm">
              {course.estimatedDurationMinutes ? `${course.estimatedDurationMinutes} min` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Created by</p>
            <p className="text-sm">
              {course.createdBy ? `${course.createdBy.firstName} ${course.createdBy.lastName}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Assigned groups</p>
            <p className="text-sm">
              {course.assignedGroups.length}{' '}
              {course.canAssign ? (
                <button
                  type="button"
                  className="text-primary underline-offset-2 hover:underline"
                  onClick={() => setAssignGroupsOpen(true)}
                >
                  Manage
                </button>
              ) : null}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Modules</p>
            <p className="text-sm">{course.modules.length}</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Modules</h2>
          {course.canEdit ? (
            <Button onClick={() => setCreateModuleOpen(true)}>
              <Plus /> Add Module
            </Button>
          ) : null}
        </div>

        {!course.canEdit ? (
          <p className="text-sm text-muted-foreground">
            Shared catalogue course — you can assign it to your groups. Only its owner can change the master
            content.
          </p>
        ) : null}
        <ModuleLessonTree courseId={course.id} modules={course.modules} readOnly={!course.canEdit} />
      </div>

      <CreateModuleDialog courseId={course.id} open={createModuleOpen} onOpenChange={setCreateModuleOpen} />

      <EditCourseDialog course={editCourseOpen ? course : null} onOpenChange={setEditCourseOpen} />

      <AssignGroupsDialog
        courseId={course.id}
        open={assignGroupsOpen}
        onOpenChange={setAssignGroupsOpen}
        defaultMandatory={course.isMandatory}
      />

      <ConfirmDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => !open && setPendingStatus(null)}
        title={pendingStatus ? `${STATUS_ACTION_LABEL[pendingStatus]} course` : ''}
        description={
          pendingStatus ? `${course.title} ${STATUS_CONFIRM_DESCRIPTION[pendingStatus]}` : undefined
        }
        confirmLabel={pendingStatus ? STATUS_ACTION_LABEL[pendingStatus] : 'Confirm'}
        destructive={pendingStatus === 'ARCHIVED'}
        onConfirm={() => void handleUpdateStatus()}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete course"
        description={`${course.title} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

export { CourseEditorPage };
