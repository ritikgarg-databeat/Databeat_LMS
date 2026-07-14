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
import { useCreateLessonMutation } from '../hooks';
import type { ResourceType } from '../types';

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

const createLessonSchema = z.object({
  title: z.string().min(1, 'Title is required.').max(200, 'Title must be 200 characters or fewer.'),
  description: z.string().max(2000, 'Description must be 2000 characters or fewer.').optional(),
  type: z.enum(RESOURCE_TYPE_VALUES),
  estimatedDurationMinutes: z
    .string()
    .optional()
    .refine((value) => !value || /^[1-9]\d*$/.test(value), 'Estimated duration must be a positive whole number.'),
});
type CreateLessonFormValues = z.infer<typeof createLessonSchema>;

export interface CreateLessonDialogProps {
  moduleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * A lesson's `type` is a primary-content-format tag, not its content — the actual resource
 * (file/text/link) is added afterward via `LessonResourceManager`.
 */
function CreateLessonDialog({ moduleId, open, onOpenChange }: CreateLessonDialogProps) {
  const createLesson = useCreateLessonMutation();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateLessonFormValues>({
    resolver: zodResolver(createLessonSchema),
    defaultValues: { type: 'MARKDOWN' },
  });

  const onSubmit = async (values: CreateLessonFormValues) => {
    try {
      await createLesson.mutateAsync({
        moduleId,
        title: values.title,
        description: values.description || undefined,
        type: values.type,
        estimatedDurationMinutes: values.estimatedDurationMinutes ? Number(values.estimatedDurationMinutes) : undefined,
      });
      toast.success('Lesson created successfully.');
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
          <DialogTitle>Add Lesson</DialogTitle>
          <DialogDescription>Create a new lesson in this module.</DialogDescription>
        </DialogHeader>

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="space-y-2">
            <Label htmlFor="lesson-title">Title</Label>
            <Input id="lesson-title" disabled={isSubmitting} {...register('title')} />
            {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lesson-description">Description</Label>
            <Textarea id="lesson-description" rows={3} disabled={isSubmitting} {...register('description')} />
            {errors.description ? <p className="text-sm text-destructive">{errors.description.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lesson-type">Type</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                  <SelectTrigger id="lesson-type">
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
            <Label htmlFor="lesson-estimatedDurationMinutes">Estimated duration (minutes)</Label>
            <Input
              id="lesson-estimatedDurationMinutes"
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
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { CreateLessonDialog };
