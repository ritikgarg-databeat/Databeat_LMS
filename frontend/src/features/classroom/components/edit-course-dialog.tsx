import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
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
import { useActiveDepartmentsOptions, useActiveExperienceLevelsOptions } from '@/features/groups/hooks';
import { getErrorMessage } from '@/utils/error';

import { DIFFICULTY_OPTIONS } from '../constants';
import { useUpdateCourseMutation } from '../hooks';
import type { Course } from '../types';

// `DIFFICULTY_OPTIONS` includes a blank "All difficulties" entry meant for filter bars — this
// dialog's difficulty select is required, so that entry is filtered out.
const REQUIRED_DIFFICULTY_OPTIONS = DIFFICULTY_OPTIONS.filter((option) => option.value !== '');

const editCourseSchema = z.object({
  title: z.string().min(1, 'Title is required.').max(150, 'Title must be 150 characters or fewer.'),
  description: z.string().max(2000, 'Description must be 2000 characters or fewer.').optional(),
  departmentId: z.string().optional(),
  experienceLevelId: z.string().optional(),
  // Kept as a raw string (matching the native <input type="number"> value) and converted to a
  // number only at submit time — avoids a zod `preprocess` mismatch between the resolver's
  // input/output types under react-hook-form's `useForm<T>` generic.
  estimatedDurationMinutes: z
    .string()
    .optional()
    .refine((value) => !value || /^[1-9]\d*$/.test(value), 'Estimated duration must be a positive whole number.'),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
});
type EditCourseFormValues = z.infer<typeof editCourseSchema>;

export interface EditCourseDialogProps {
  course: Course | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Status is deliberately not editable here — `PATCH /courses/:id` doesn't accept `status`;
 * publish/unpublish/archive go through the dedicated row actions in course-list-page.tsx.
 */
function EditCourseDialog({ course, onOpenChange }: EditCourseDialogProps) {
  const updateCourse = useUpdateCourseMutation();
  const { data: departments } = useActiveDepartmentsOptions();
  const { data: experienceLevels } = useActiveExperienceLevelsOptions();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditCourseFormValues>({
    resolver: zodResolver(editCourseSchema),
    values: course
      ? {
          title: course.title,
          description: course.description ?? '',
          departmentId: course.departmentId ?? '',
          experienceLevelId: course.experienceLevelId ?? '',
          estimatedDurationMinutes:
            course.estimatedDurationMinutes !== null ? String(course.estimatedDurationMinutes) : '',
          difficulty: course.difficulty,
        }
      : undefined,
  });

  if (!course) return null;

  const onSubmit = async (values: EditCourseFormValues) => {
    try {
      // The "None" <option> has value="" — normalize it to null or the backend's optional-field
      // validators reject the empty string as an invalid uuid.
      await updateCourse.mutateAsync({
        id: course.id,
        payload: {
          title: values.title,
          description: values.description || null,
          departmentId: values.departmentId || null,
          experienceLevelId: values.experienceLevelId || null,
          estimatedDurationMinutes: values.estimatedDurationMinutes ? Number(values.estimatedDurationMinutes) : null,
          difficulty: values.difficulty,
        },
      });
      toast.success('Course updated successfully.');
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {course.title}</DialogTitle>
          <DialogDescription>Update the course&apos;s details.</DialogDescription>
        </DialogHeader>

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" disabled={isSubmitting} {...register('title')} />
            {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea id="edit-description" rows={3} disabled={isSubmitting} {...register('description')} />
            {errors.description ? (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-departmentId">Department</Label>
              <Controller
                name="departmentId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="edit-departmentId">
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {departments?.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-experienceLevelId">Experience level</Label>
              <Controller
                name="experienceLevelId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="edit-experienceLevelId">
                      <SelectValue placeholder="Select an experience level" />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-estimatedDurationMinutes">Estimated duration (minutes)</Label>
              <Input
                id="edit-estimatedDurationMinutes"
                type="number"
                min={1}
                disabled={isSubmitting}
                {...register('estimatedDurationMinutes')}
              />
              {errors.estimatedDurationMinutes ? (
                <p className="text-sm text-destructive">{errors.estimatedDurationMinutes.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-difficulty">Difficulty</Label>
              <Controller
                name="difficulty"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                    <SelectTrigger id="edit-difficulty">
                      <SelectValue placeholder="Select a difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      {REQUIRED_DIFFICULTY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { EditCourseDialog };
