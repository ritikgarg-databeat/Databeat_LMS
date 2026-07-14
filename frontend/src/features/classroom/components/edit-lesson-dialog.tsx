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
import { getErrorMessage } from '@/utils/error';

import { RESOURCE_TYPE_META } from '../constants';
import { useUpdateLessonMutation } from '../hooks';
import type { Lesson, ResourceType } from '../types';

// Mirrors `ResourceType` exactly — kept as an explicit tuple so `z.enum` can validate the
// native <select>'s string value without redefining the type union itself.
const RESOURCE_TYPE_VALUES = [
  'MARKDOWN',
  'PDF',
  'VIDEO',
  'IMAGE',
  'PRESENTATION',
  'DOCUMENT',
  'ZIP',
  'EXTERNAL_LINK',
  'CODE_SNIPPET',
] as const satisfies readonly ResourceType[];

const editLessonSchema = z.object({
  title: z.string().min(1, 'Title is required.').max(200, 'Title must be 200 characters or fewer.'),
  description: z.string().max(2000, 'Description must be 2000 characters or fewer.').optional(),
  type: z.enum(RESOURCE_TYPE_VALUES),
  estimatedDurationMinutes: z
    .string()
    .optional()
    .refine((value) => !value || /^[1-9]\d*$/.test(value), 'Estimated duration must be a positive whole number.'),
});
type EditLessonFormValues = z.infer<typeof editLessonSchema>;

export interface EditLessonDialogProps {
  lesson: Lesson | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * `type` IS editable here (per the backend's `PATCH /lessons/:id` contract) even though it's
 * really a primary-content-format tag rather than the lesson's actual content — the content
 * itself lives in `LessonResource`s, managed separately via `LessonResourceManager`.
 */
function EditLessonDialog({ lesson, onOpenChange }: EditLessonDialogProps) {
  const updateLesson = useUpdateLessonMutation();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditLessonFormValues>({
    resolver: zodResolver(editLessonSchema),
    values: lesson
      ? {
          title: lesson.title,
          description: lesson.description ?? '',
          type: lesson.type,
          estimatedDurationMinutes: lesson.estimatedDurationMinutes !== null ? String(lesson.estimatedDurationMinutes) : '',
        }
      : undefined,
  });

  if (!lesson) return null;

  const onSubmit = async (values: EditLessonFormValues) => {
    try {
      await updateLesson.mutateAsync({
        id: lesson.id,
        payload: {
          title: values.title,
          description: values.description || null,
          type: values.type,
          estimatedDurationMinutes: values.estimatedDurationMinutes ? Number(values.estimatedDurationMinutes) : null,
        },
      });
      toast.success('Lesson updated successfully.');
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {lesson.title}</DialogTitle>
          <DialogDescription>Update the lesson&apos;s details.</DialogDescription>
        </DialogHeader>

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="space-y-2">
            <Label htmlFor="edit-lesson-title">Title</Label>
            <Input id="edit-lesson-title" disabled={isSubmitting} {...register('title')} />
            {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-lesson-description">Description</Label>
            <Textarea id="edit-lesson-description" rows={3} disabled={isSubmitting} {...register('description')} />
            {errors.description ? <p className="text-sm text-destructive">{errors.description.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-lesson-type">Type</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                  <SelectTrigger id="edit-lesson-type">
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOURCE_TYPE_VALUES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {RESOURCE_TYPE_META[type].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.type ? <p className="text-sm text-destructive">{errors.type.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-lesson-estimatedDurationMinutes">Estimated duration (minutes)</Label>
            <Input
              id="edit-lesson-estimatedDurationMinutes"
              type="number"
              min={1}
              disabled={isSubmitting}
              {...register('estimatedDurationMinutes')}
            />
            {errors.estimatedDurationMinutes ? (
              <p className="text-sm text-destructive">{errors.estimatedDurationMinutes.message}</p>
            ) : null}
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

export { EditLessonDialog };
