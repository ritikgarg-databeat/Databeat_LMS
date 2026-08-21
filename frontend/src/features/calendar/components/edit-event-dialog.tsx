import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useActiveDepartmentsOptions, useGroupsQuery } from '@/features/groups/hooks';
import { getErrorMessage } from '@/utils/error';

import { useDeleteCalendarEventMutation, useUpdateCalendarEventMutation } from '../hooks';
import type { CalendarEvent } from '../types';

import { EVENT_TYPE_META, EVENT_TYPE_VALUES } from './event-type-badge';

// Mirrors backend/src/constants/assessment.ts's calendar-event caps exactly.
const MAX_TITLE_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_LOCATION_LENGTH = 300;

/** ISO datetime string -> the local-time value a native `<input type="datetime-local">` expects. */
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const editEventSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Title is required.')
      .max(MAX_TITLE_LENGTH, `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`),
    description: z
      .string()
      .max(MAX_DESCRIPTION_LENGTH, `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`)
      .optional(),
    type: z.enum(['CLASS', 'LIVE_SESSION', 'ASSESSMENT', 'DEADLINE', 'HOLIDAY', 'MEETING', 'REMINDER']),
    allDay: z.boolean(),
    startAt: z.string().min(1, 'Start date/time is required.'),
    endAt: z.string().optional(),
    location: z
      .string()
      .max(MAX_LOCATION_LENGTH, `Location must be ${MAX_LOCATION_LENGTH} characters or fewer.`)
      .optional(),
    departmentIds: z.array(z.string()),
    groupIds: z.array(z.string()),
  })
  .refine((values) => !values.endAt || values.endAt >= values.startAt, {
    message: 'End must be on or after the start.',
    path: ['endAt'],
  });
type EditEventFormValues = z.infer<typeof editEventSchema>;

export interface EditEventDialogProps {
  event: CalendarEvent | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * `departmentIds`/`groupIds` are always sent on submit below (even unchanged, even `[]`) — the
 * backend replaces the full assignment set whenever either key is present in the request body, so
 * omitting them here would be the only way to "leave assignments untouched", which is never what
 * an explicit edit-and-save action should do. See `UpdateCalendarEventPayload`.
 *
 * Status is deliberately not editable here — there's no calendar-event status concept, unlike
 * courses/assessments (this event either exists or, via Delete below, doesn't).
 */
function EditEventDialog({ event, onOpenChange }: EditEventDialogProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteEvent = useDeleteCalendarEventMutation();

  if (!event) return null;

  const handleDelete = async () => {
    try {
      await deleteEvent.mutateAsync(event.id);
      toast.success(`${event.title} deleted.`);
      setConfirmingDelete(false);
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <>
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {event.title}</DialogTitle>
            <DialogDescription>Update this event&apos;s details.</DialogDescription>
          </DialogHeader>

          {/*
            Keyed by event.id so a fresh `EditEventForm` (and fresh `useForm()` call) mounts per
            event, seeded with `defaultValues` computed directly from already-resolved data —
            see edit-question-dialog.tsx for the full rationale. Same underlying issue here, but
            worse: `departmentIds`/`groupIds` (driven by `watch()`, previously hydrated only via
            a `values`-resync effect that applies a tick after this dialog's very first render)
            read as `undefined` on that first render, and `undefined.includes(...)` in the
            Departments/Groups checkbox lists crashed the whole page — reproduced live by simply
            opening this dialog once departments/groups data was already cached (e.g. right after
            using Create Event, which warms that same cache).
          */}
          <EditEventForm
            key={event.id}
            event={event}
            onOpenChange={onOpenChange}
            onRequestDelete={() => setConfirmingDelete(true)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete event"
        description={`${event.title} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}

interface EditEventFormProps {
  event: CalendarEvent;
  onOpenChange: (open: boolean) => void;
  onRequestDelete: () => void;
}

function EditEventForm({ event, onOpenChange, onRequestDelete }: EditEventFormProps) {
  const updateEvent = useUpdateCalendarEventMutation();
  const { data: departments } = useActiveDepartmentsOptions();
  const { data: groupsPage } = useGroupsQuery({ page: 1, pageSize: 100, status: 'ACTIVE' });
  const groups = groupsPage?.items ?? [];

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EditEventFormValues>({
    resolver: zodResolver(editEventSchema),
    defaultValues: {
      title: event.title,
      description: event.description ?? '',
      type: event.type,
      allDay: event.allDay,
      startAt: toDatetimeLocalValue(event.startAt),
      endAt: toDatetimeLocalValue(event.endAt),
      location: event.location ?? '',
      departmentIds: event.assignments.departments.map((department) => department.id),
      groupIds: event.assignments.groups.map((group) => group.id),
    },
  });

  const departmentIds = useWatch({ control, name: 'departmentIds' });
  const groupIds = useWatch({ control, name: 'groupIds' });

  const toggleDepartment = (id: string) => {
    setValue(
      'departmentIds',
      departmentIds.includes(id)
        ? departmentIds.filter((existing) => existing !== id)
        : [...departmentIds, id],
      { shouldDirty: true },
    );
  };

  const toggleGroup = (id: string) => {
    setValue(
      'groupIds',
      groupIds.includes(id) ? groupIds.filter((existing) => existing !== id) : [...groupIds, id],
      {
        shouldDirty: true,
      },
    );
  };

  const onSubmit = async (values: EditEventFormValues) => {
    try {
      await updateEvent.mutateAsync({
        id: event.id,
        payload: {
          title: values.title,
          description: values.description || null,
          type: values.type,
          startAt: new Date(values.startAt).toISOString(),
          endAt: values.endAt ? new Date(values.endAt).toISOString() : null,
          allDay: values.allDay,
          location: values.location || null,
          departmentIds: values.departmentIds,
          groupIds: values.groupIds,
        },
      });
      toast.success('Event updated successfully.');
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <form noValidate className="space-y-4" onSubmit={(formEvent) => void handleSubmit(onSubmit)(formEvent)}>
      <div className="space-y-2">
        <Label htmlFor="edit-title">Title</Label>
        <Input id="edit-title" disabled={isSubmitting} {...register('title')} />
        {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-description">Description</Label>
        <Textarea id="edit-description" rows={3} disabled={isSubmitting} {...register('description')} />
        {errors.description ? <p className="text-sm text-destructive">{errors.description.message}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-type">Type</Label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                <SelectTrigger id="edit-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPE_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {EVENT_TYPE_META[value].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex items-end pb-2">
          <label htmlFor="edit-allDay" className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              id="edit-allDay"
              type="checkbox"
              className="size-4 rounded border-input"
              disabled={isSubmitting}
              {...register('allDay')}
            />
            All day
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-startAt">Start date/time</Label>
          <Input id="edit-startAt" type="datetime-local" disabled={isSubmitting} {...register('startAt')} />
          {errors.startAt ? <p className="text-sm text-destructive">{errors.startAt.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-endAt">End date/time</Label>
          <Input id="edit-endAt" type="datetime-local" disabled={isSubmitting} {...register('endAt')} />
          {errors.endAt ? <p className="text-sm text-destructive">{errors.endAt.message}</p> : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-location">Location</Label>
        <Input
          id="edit-location"
          placeholder="Room number, or a meeting URL"
          disabled={isSubmitting}
          {...register('location')}
        />
        <p className="text-sm text-muted-foreground">
          Can be a physical location, or a URL for a Live Session/Meeting.
        </p>
        {errors.location ? <p className="text-sm text-destructive">{errors.location.message}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Departments</Label>
          <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
            {!departments?.length ? (
              <p className="p-1 text-sm text-muted-foreground">No departments available.</p>
            ) : (
              departments.map((department) => (
                <label
                  key={department.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input"
                    checked={departmentIds.includes(department.id)}
                    onChange={() => toggleDepartment(department.id)}
                    disabled={isSubmitting}
                  />
                  {department.name}
                </label>
              ))
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Groups</Label>
          <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
            {!groups.length ? (
              <p className="p-1 text-sm text-muted-foreground">No groups available.</p>
            ) : (
              groups.map((group) => (
                <label
                  key={group.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input"
                    checked={groupIds.includes(group.id)}
                    onChange={() => toggleGroup(group.id)}
                    disabled={isSubmitting}
                  />
                  {group.name} ({group.code})
                </label>
              ))
            )}
          </div>
        </div>
      </div>

      <DialogFooter className="sm:justify-between">
        <Button type="button" variant="destructive" disabled={isSubmitting} onClick={onRequestDelete}>
          Delete
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save changes'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export { EditEventDialog };
