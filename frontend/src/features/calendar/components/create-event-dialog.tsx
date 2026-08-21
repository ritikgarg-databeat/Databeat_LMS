import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

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

import { useCreateCalendarEventMutation } from '../hooks';

import { EVENT_TYPE_META, EVENT_TYPE_VALUES } from './event-type-badge';

// Mirrors backend/src/constants/assessment.ts's calendar-event caps exactly.
const MAX_TITLE_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_LOCATION_LENGTH = 300;

const createEventSchema = z
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
type CreateEventFormValues = z.infer<typeof createEventSchema>;

export interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** An event always starts with no assignments — departments/groups are opted into here, not defaulted. */
function CreateEventDialog({ open, onOpenChange }: CreateEventDialogProps) {
  const createEvent = useCreateCalendarEventMutation();
  const { data: departments } = useActiveDepartmentsOptions();
  const { data: groupsPage } = useGroupsQuery({ page: 1, pageSize: 100, status: 'ACTIVE' });
  const groups = groupsPage?.items ?? [];

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateEventFormValues>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      type: 'CLASS',
      allDay: false,
      startAt: '',
      endAt: '',
      departmentIds: [],
      groupIds: [],
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

  const onSubmit = async (values: CreateEventFormValues) => {
    try {
      await createEvent.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        type: values.type,
        startAt: new Date(values.startAt).toISOString(),
        endAt: values.endAt ? new Date(values.endAt).toISOString() : undefined,
        allDay: values.allDay,
        location: values.location || undefined,
        departmentIds: values.departmentIds,
        groupIds: values.groupIds,
      });
      toast.success('Event created successfully.');
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Event</DialogTitle>
          <DialogDescription>Add a class, session, deadline, or other calendar event.</DialogDescription>
        </DialogHeader>

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" disabled={isSubmitting} {...register('title')} />
            {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} disabled={isSubmitting} {...register('description')} />
            {errors.description ? (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                    <SelectTrigger id="type">
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
              <label htmlFor="allDay" className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  id="allDay"
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
              <Label htmlFor="startAt">Start date/time</Label>
              <Input id="startAt" type="datetime-local" disabled={isSubmitting} {...register('startAt')} />
              {errors.startAt ? <p className="text-sm text-destructive">{errors.startAt.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endAt">End date/time</Label>
              <Input id="endAt" type="datetime-local" disabled={isSubmitting} {...register('endAt')} />
              {errors.endAt ? <p className="text-sm text-destructive">{errors.endAt.message}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
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

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { CreateEventDialog };
