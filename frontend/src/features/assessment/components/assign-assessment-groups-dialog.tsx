import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { ConfirmDialog } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGroupsQuery } from '@/features/groups/hooks';
import { getErrorMessage } from '@/utils/error';

import { useAssessmentAssignmentsQuery, useAssignGroupMutation, useUnassignGroupMutation } from '../hooks';
import type { AssessmentGroupAssignmentSummary } from '../types';

const assignGroupSchema = z.object({ groupId: z.string().min(1, 'Choose a group.') });
type AssignGroupFormValues = z.infer<typeof assignGroupSchema>;

export interface AssignAssessmentGroupsDialogProps {
  assessmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Lists groups currently assigned to an assessment, and lets a trainer assign more ACTIVE groups. */
function AssignAssessmentGroupsDialog({
  assessmentId,
  open,
  onOpenChange,
}: AssignAssessmentGroupsDialogProps) {
  const [unassigning, setUnassigning] = useState<AssessmentGroupAssignmentSummary | null>(null);

  const { data: assignments, isLoading: isLoadingAssignments } = useAssessmentAssignmentsQuery(
    open ? assessmentId : undefined,
  );
  // Capped at the backend's page-size ceiling, same convention as assign-groups-dialog.tsx.
  const { data: groupsPage, isLoading: isLoadingGroups } = useGroupsQuery({
    page: 1,
    pageSize: 100,
    status: 'ACTIVE',
  });

  const assignGroup = useAssignGroupMutation();
  const unassignGroup = useUnassignGroupMutation();

  const assignedGroupIds = useMemo(
    () => new Set((assignments ?? []).map((assignment) => assignment.id)),
    [assignments],
  );
  const availableGroups = useMemo(
    () => (groupsPage?.items ?? []).filter((group) => !assignedGroupIds.has(group.id)),
    [groupsPage, assignedGroupIds],
  );

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssignGroupFormValues>({
    resolver: zodResolver(assignGroupSchema),
    defaultValues: { groupId: '' },
  });

  const onSubmit = async (values: AssignGroupFormValues) => {
    try {
      await assignGroup.mutateAsync({ assessmentId, payload: { groupId: values.groupId } });
      toast.success('Group assigned successfully.');
      reset();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUnassign = async () => {
    if (!unassigning) return;
    try {
      await unassignGroup.mutateAsync({ assessmentId, groupId: unassigning.id });
      toast.success(`${unassigning.name} unassigned.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUnassigning(null);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign to Groups</DialogTitle>
            <DialogDescription>Control which groups can access this assessment.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm font-medium">Currently assigned</p>
            {isLoadingAssignments ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : !assignments?.length ? (
              <p className="text-sm text-muted-foreground">No groups assigned yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">{assignment.name}</TableCell>
                      <TableCell>{assignment.code}</TableCell>
                      <TableCell>{assignment.memberCount}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setUnassigning(assignment)}
                        >
                          Unassign
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <form
            noValidate
            className="space-y-2 border-t pt-4"
            onSubmit={(event) => void handleSubmit(onSubmit)(event)}
          >
            <Label htmlFor="assign-assessment-group-groupId">Assign a group</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Controller
                name="groupId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting || isLoadingGroups || availableGroups.length === 0}
                  >
                    <SelectTrigger id="assign-assessment-group-groupId" className="w-full">
                      <SelectValue
                        placeholder={
                          isLoadingGroups
                            ? 'Loading groups...'
                            : availableGroups.length === 0
                              ? 'No groups available to assign'
                              : 'Select a group'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name} ({group.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Button type="submit" disabled={isSubmitting || availableGroups.length === 0}>
                {isSubmitting ? 'Assigning...' : 'Assign'}
              </Button>
            </div>
            {errors.groupId ? <p className="text-sm text-destructive">{errors.groupId.message}</p> : null}
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={unassigning !== null}
        onOpenChange={(open_) => !open_ && setUnassigning(null)}
        title="Unassign group"
        description={unassigning ? `${unassigning.name} will lose access to this assessment.` : undefined}
        confirmLabel="Unassign"
        destructive
        onConfirm={() => void handleUnassign()}
      />
    </>
  );
}

export { AssignAssessmentGroupsDialog };
