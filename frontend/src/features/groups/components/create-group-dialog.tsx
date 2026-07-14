import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { SearchBox } from '@/components/shared';
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
import { useAssignGroupMutation, useCoursesQuery } from '@/features/classroom/hooks';
import { getErrorMessage } from '@/utils/error';

import { useActiveDepartmentsOptions, useActiveExperienceLevelsOptions, useCreateGroupMutation, useTrainersOptions } from '../hooks';

// Case-insensitive here — the value is uppercased on submit before being sent to the API,
// which itself only accepts the uppercase form (see backend groups.validation.ts).
const CODE_PATTERN = /^[A-Za-z0-9_-]{2,40}$/;

const createGroupSchema = z
  .object({
    name: z.string().min(1, 'Name is required.').max(150, 'Name must be 150 characters or fewer.'),
    code: z
      .string()
      .min(1, 'Code is required.')
      .regex(CODE_PATTERN, 'Code must be 2-40 letters, numbers, underscores, or dashes.'),
    departmentId: z.string().min(1, 'Department is required.'),
    experienceLevelId: z.string().optional(),
    trainerId: z.string().optional(),
    description: z.string().max(1000, 'Description must be 1000 characters or fewer.').optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    // Kept as a raw string (matching the native <input type="number"> value) and converted to
    // a number only at submit time — avoids a zod `preprocess` mismatch between the resolver's
    // input/output types under react-hook-form's `useForm<T>` generic.
    capacity: z
      .string()
      .optional()
      .refine((value) => !value || /^[1-9]\d*$/.test(value), 'Capacity must be a positive whole number.'),
  })
  .refine((values) => !values.startDate || !values.endDate || values.startDate <= values.endDate, {
    message: 'End date must be on or after the start date.',
    path: ['endDate'],
  });
type CreateGroupFormValues = z.infer<typeof createGroupSchema>;

export interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const [courseSearch, setCourseSearch] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);

  const createGroup = useCreateGroupMutation();
  const assignGroup = useAssignGroupMutation();
  const { data: departments } = useActiveDepartmentsOptions();
  const { data: experienceLevels } = useActiveExperienceLevelsOptions();
  const { data: trainers } = useTrainersOptions();
  // Capped at the backend's page-size ceiling, same convention as assign-groups-dialog.tsx's own
  // group picker. PUBLISHED only — a draft/archived course has nothing a trainee could see yet,
  // so assigning one to a brand-new group wouldn't do anything useful.
  const { data: coursesPage, isLoading: isLoadingCourses } = useCoursesQuery({
    page: 1,
    pageSize: 100,
    status: 'PUBLISHED',
  });

  const availableCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase();
    const courses = coursesPage?.items ?? [];
    if (!query) return courses;
    return courses.filter(
      (course) =>
        course.title.toLowerCase().includes(query) || (course.department?.name.toLowerCase().includes(query) ?? false),
    );
  }, [coursesPage, courseSearch]);

  const toggleCourse = (id: string) => {
    setSelectedCourseIds((previous) =>
      previous.includes(id) ? previous.filter((existing) => existing !== id) : [...previous, id],
    );
  };

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateGroupFormValues>({ resolver: zodResolver(createGroupSchema) });

  const onSubmit = async (values: CreateGroupFormValues) => {
    try {
      // The "None" <option> has value="" — normalize it away or the backend's optional-field
      // validators reject the empty string as an invalid uuid/date.
      const group = await createGroup.mutateAsync({
        name: values.name,
        code: values.code.toUpperCase(),
        departmentId: values.departmentId,
        experienceLevelId: values.experienceLevelId || undefined,
        trainerId: values.trainerId || undefined,
        description: values.description || undefined,
        startDate: values.startDate || undefined,
        endDate: values.endDate || undefined,
        capacity: values.capacity ? Number(values.capacity) : undefined,
      });

      if (selectedCourseIds.length > 0) {
        // Each course-group assignment is its own independent API call (there's no bulk
        // "assign N courses to one group" endpoint — the assignment is modeled from the
        // course side, see assign-groups-dialog.tsx). `allSettled`, not `all`, so one course
        // that's somehow already assigned or fails validation doesn't roll back the group
        // itself, which was already created successfully by this point.
        const results = await Promise.allSettled(
          selectedCourseIds.map((courseId) => assignGroup.mutateAsync({ courseId, payload: { groupId: group.id } })),
        );
        const failed = results.filter((result) => result.status === 'rejected').length;
        const succeeded = results.length - failed;
        toast.success(
          failed === 0
            ? `Group created successfully. ${succeeded} course${succeeded === 1 ? '' : 's'} assigned.`
            : `Group created successfully. ${succeeded} of ${results.length} courses assigned (${failed} failed).`,
        );
      } else {
        toast.success('Group created successfully.');
      }

      reset();
      setSelectedCourseIds([]);
      setCourseSearch('');
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          setSelectedCourseIds([]);
          setCourseSearch('');
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Group</DialogTitle>
          <DialogDescription>Set up a new training batch.</DialogDescription>
        </DialogHeader>

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" disabled={isSubmitting} {...register('name')} />
            {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input id="code" placeholder="e.g. BATCH-2026-01" disabled={isSubmitting} {...register('code')} />
            <p className="text-sm text-muted-foreground">
              2-40 letters, numbers, underscores, or dashes. Will be converted to uppercase.
            </p>
            {errors.code ? <p className="text-sm text-destructive">{errors.code.message}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="departmentId">Department</Label>
              <Controller
                name="departmentId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                    <SelectTrigger id="departmentId">
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments?.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.departmentId ? (
                <p className="text-sm text-destructive">{errors.departmentId.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="experienceLevelId">Experience level</Label>
              <Controller
                name="experienceLevelId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="experienceLevelId">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {experienceLevels?.map((level) => (
                        <SelectItem key={level.id} value={level.id}>
                          {level.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trainerId">Trainer</Label>
            <Controller
              name="trainerId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || 'none'}
                  onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="trainerId">
                    <SelectValue placeholder="Select a trainer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {trainers?.map((trainer) => (
                      <SelectItem key={trainer.id} value={trainer.id}>
                        {trainer.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} disabled={isSubmitting} {...register('description')} />
            {errors.description ? (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Courses to assign</Label>
            <p className="text-sm text-muted-foreground">
              Optional — pick any published courses this group should have access to right away.
              You can also assign more later from each course&rsquo;s own &ldquo;Assign to
              Groups&rdquo; screen.
            </p>
            <SearchBox value={courseSearch} onChange={setCourseSearch} placeholder="Search courses..." />
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
              {isLoadingCourses ? (
                <p className="p-2 text-sm text-muted-foreground">Loading courses...</p>
              ) : availableCourses.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">
                  {courseSearch ? 'No courses match your search.' : 'No published courses available yet.'}
                </p>
              ) : (
                availableCourses.map((course) => (
                  <label
                    key={course.id}
                    htmlFor={`create-group-course-${course.id}`}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <input
                      id={`create-group-course-${course.id}`}
                      type="checkbox"
                      className="size-4 rounded border-input"
                      checked={selectedCourseIds.includes(course.id)}
                      disabled={isSubmitting}
                      onChange={() => toggleCourse(course.id)}
                    />
                    <span className="flex-1 font-medium">
                      {course.title}
                      {course.department ? (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {course.department.name}
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))
              )}
            </div>
            {selectedCourseIds.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {selectedCourseIds.length} course{selectedCourseIds.length === 1 ? '' : 's'} selected.
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" type="date" disabled={isSubmitting} {...register('startDate')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End date</Label>
              <Input id="endDate" type="date" disabled={isSubmitting} {...register('endDate')} />
              {errors.endDate ? <p className="text-sm text-destructive">{errors.endDate.message}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="capacity">Capacity</Label>
            <Input id="capacity" type="number" min={1} disabled={isSubmitting} {...register('capacity')} />
            {errors.capacity ? <p className="text-sm text-destructive">{errors.capacity.message}</p> : null}
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

export { CreateGroupDialog };
