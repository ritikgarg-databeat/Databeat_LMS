import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { useCreateCourseMutation } from '../hooks';

// `DIFFICULTY_OPTIONS` includes a blank "All difficulties" entry meant for filter bars — this
// dialog's difficulty select is required (defaults to BEGINNER), so that entry is filtered out.
const REQUIRED_DIFFICULTY_OPTIONS = DIFFICULTY_OPTIONS.filter((option) => option.value !== '');

const createCourseSchema = z.object({
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
type CreateCourseFormValues = z.infer<typeof createCourseSchema>;

export interface CreateCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Thumbnail upload is deliberately out of scope here — there's no upload endpoint for it yet,
 * and courses always start in DRAFT server-side, so there's no status field either.
 */
function CreateCourseDialog({ open, onOpenChange }: CreateCourseDialogProps) {
  const createCourse = useCreateCourseMutation();
  const { data: departments } = useActiveDepartmentsOptions();
  const { data: experienceLevels } = useActiveExperienceLevelsOptions();
  const navigate = useNavigate();
  // Same admin-vs-trainer basePath derivation course-list-page.tsx already uses — this dialog
  // is mounted from that page in both role branches, so it needs its own copy rather than a
  // prop threaded through.
  const isAdminRoute = useLocation().pathname.startsWith('/admin');
  const basePath = isAdminRoute ? '/admin' : '/trainer';

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCourseFormValues>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: { difficulty: 'BEGINNER' },
  });

  const onSubmit = async (values: CreateCourseFormValues) => {
    try {
      // The "None" <option> has value="" — normalize it away or the backend's optional-field
      // validators reject the empty string as an invalid uuid.
      const course = await createCourse.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        departmentId: values.departmentId || undefined,
        experienceLevelId: values.experienceLevelId || undefined,
        estimatedDurationMinutes: values.estimatedDurationMinutes ? Number(values.estimatedDurationMinutes) : undefined,
        difficulty: values.difficulty,
      });
      toast.success('Course created — now add modules, lessons, and material.');
      reset();
      onOpenChange(false);
      // Straight into the editor rather than back to the list — a brand-new course has no
      // modules/lessons/material yet, so that's the very next thing a trainer needs to do.
      navigate(`${basePath}/classroom/${course.id}`);
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
          <DialogTitle>Create Course</DialogTitle>
          <DialogDescription>Set up a new course. It starts as a draft.</DialogDescription>
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
              <Label htmlFor="departmentId">Department</Label>
              <Controller
                name="departmentId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || 'none'}
                    onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="departmentId">
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
              <Label htmlFor="estimatedDurationMinutes">Estimated duration (minutes)</Label>
              <Input
                id="estimatedDurationMinutes"
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
              <Label htmlFor="difficulty">Difficulty</Label>
              <Controller
                name="difficulty"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                    <SelectTrigger id="difficulty">
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
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { CreateCourseDialog };
