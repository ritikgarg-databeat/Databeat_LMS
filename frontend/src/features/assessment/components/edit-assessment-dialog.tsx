import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/utils/error';

import { useUpdateAssessmentMutation } from '../hooks';
import type { Assessment } from '../types';

// Mirrors backend/src/constants/assessment.ts's caps exactly.
const MAX_TITLE_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_INSTRUCTIONS_LENGTH = 5000;
const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 600;
const MIN_NEGATIVE_MARKS = 0;
const MAX_NEGATIVE_MARKS = 100;

/** ISO datetime string -> the local-time value a native `<input type="datetime-local">` expects. */
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Numeric fields are kept as raw strings (matching the native <input type="number"> value) and
// converted at submit time — avoids a zod `preprocess` mismatch between the resolver's
// input/output types under react-hook-form's `useForm<T>` generic (see create-group-dialog.tsx).
const editAssessmentSchema = z
  .object({
    title: z.string().min(1, 'Title is required.').max(MAX_TITLE_LENGTH, `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`),
    description: z
      .string()
      .max(MAX_DESCRIPTION_LENGTH, `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`)
      .optional(),
    durationMinutes: z
      .string()
      .min(1, 'Duration is required.')
      .refine((value) => {
        const n = Number(value);
        return Number.isInteger(n) && n >= MIN_DURATION_MINUTES && n <= MAX_DURATION_MINUTES;
      }, `Duration must be a whole number between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES} minutes.`),
    passingPercentage: z
      .string()
      .min(1, 'Passing percentage is required.')
      .refine((value) => {
        const n = Number(value);
        return Number.isInteger(n) && n >= 0 && n <= 100;
      }, 'Passing percentage must be a whole number between 0 and 100.'),
    availableFrom: z.string().optional(),
    dueDate: z.string().optional(),
    instructions: z
      .string()
      .max(MAX_INSTRUCTIONS_LENGTH, `Instructions must be ${MAX_INSTRUCTIONS_LENGTH} characters or fewer.`)
      .optional(),
    negativeMarkingEnabled: z.boolean(),
    negativeMarksPerWrongAnswer: z.string().optional(),
    randomizeQuestions: z.boolean(),
    showResultImmediately: z.boolean(),
  })
  .refine((values) => !values.availableFrom || !values.dueDate || values.availableFrom <= values.dueDate, {
    message: 'Due date must be on or after the available-from date.',
    path: ['dueDate'],
  })
  .refine(
    (values) => {
      if (!values.negativeMarkingEnabled) return true;
      if (!values.negativeMarksPerWrongAnswer) return false;
      const n = Number(values.negativeMarksPerWrongAnswer);
      return Number.isFinite(n) && n >= MIN_NEGATIVE_MARKS && n <= MAX_NEGATIVE_MARKS;
    },
    {
      message: `Marks per wrong answer is required (${MIN_NEGATIVE_MARKS}-${MAX_NEGATIVE_MARKS}) when negative marking is enabled.`,
      path: ['negativeMarksPerWrongAnswer'],
    },
  );
type EditAssessmentFormValues = z.infer<typeof editAssessmentSchema>;

export interface EditAssessmentDialogProps {
  assessment: Assessment | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Status is deliberately not editable here — `PATCH /assessments/:id` doesn't accept `status`;
 * publish/unpublish/archive go through the dedicated status-transition actions elsewhere.
 */
function EditAssessmentDialog({ assessment, onOpenChange }: EditAssessmentDialogProps) {
  const updateAssessment = useUpdateAssessmentMutation();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditAssessmentFormValues>({
    resolver: zodResolver(editAssessmentSchema),
    values: assessment
      ? {
          title: assessment.title,
          description: assessment.description ?? '',
          durationMinutes: String(assessment.durationMinutes),
          passingPercentage: String(assessment.passingPercentage),
          availableFrom: toDatetimeLocalValue(assessment.availableFrom),
          dueDate: toDatetimeLocalValue(assessment.dueDate),
          instructions: assessment.instructions ?? '',
          negativeMarkingEnabled: assessment.negativeMarkingEnabled,
          negativeMarksPerWrongAnswer:
            assessment.negativeMarksPerWrongAnswer !== null ? String(assessment.negativeMarksPerWrongAnswer) : '',
          randomizeQuestions: assessment.randomizeQuestions,
          showResultImmediately: assessment.showResultImmediately,
        }
      : undefined,
  });

  const negativeMarkingEnabled = useWatch({ control, name: 'negativeMarkingEnabled' });

  if (!assessment) return null;

  const onSubmit = async (values: EditAssessmentFormValues) => {
    try {
      await updateAssessment.mutateAsync({
        id: assessment.id,
        payload: {
          title: values.title,
          description: values.description || null,
          durationMinutes: Number(values.durationMinutes),
          passingPercentage: Number(values.passingPercentage),
          availableFrom: values.availableFrom ? new Date(values.availableFrom).toISOString() : null,
          dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : null,
          instructions: values.instructions || null,
          negativeMarkingEnabled: values.negativeMarkingEnabled,
          negativeMarksPerWrongAnswer:
            values.negativeMarkingEnabled && values.negativeMarksPerWrongAnswer
              ? Number(values.negativeMarksPerWrongAnswer)
              : null,
          randomizeQuestions: values.randomizeQuestions,
          showResultImmediately: values.showResultImmediately,
        },
      });
      toast.success('Assessment updated successfully.');
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {assessment.title}</DialogTitle>
          <DialogDescription>Update the assessment&apos;s details.</DialogDescription>
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
            {errors.description ? <p className="text-sm text-destructive">{errors.description.message}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-durationMinutes">Duration (minutes)</Label>
              <Input
                id="edit-durationMinutes"
                type="number"
                min={MIN_DURATION_MINUTES}
                max={MAX_DURATION_MINUTES}
                disabled={isSubmitting}
                {...register('durationMinutes')}
              />
              {errors.durationMinutes ? (
                <p className="text-sm text-destructive">{errors.durationMinutes.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-passingPercentage">Passing percentage</Label>
              <Input
                id="edit-passingPercentage"
                type="number"
                min={0}
                max={100}
                disabled={isSubmitting}
                {...register('passingPercentage')}
              />
              {errors.passingPercentage ? (
                <p className="text-sm text-destructive">{errors.passingPercentage.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-availableFrom">Available from</Label>
              <Input
                id="edit-availableFrom"
                type="datetime-local"
                disabled={isSubmitting}
                {...register('availableFrom')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dueDate">Due date</Label>
              <Input id="edit-dueDate" type="datetime-local" disabled={isSubmitting} {...register('dueDate')} />
              {errors.dueDate ? <p className="text-sm text-destructive">{errors.dueDate.message}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-instructions">Instructions</Label>
            <Textarea id="edit-instructions" rows={3} disabled={isSubmitting} {...register('instructions')} />
            {errors.instructions ? <p className="text-sm text-destructive">{errors.instructions.message}</p> : null}
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <input
                id="edit-negativeMarkingEnabled"
                type="checkbox"
                className="size-4 rounded border-input"
                disabled={isSubmitting}
                {...register('negativeMarkingEnabled')}
              />
              <Label htmlFor="edit-negativeMarkingEnabled" className="cursor-pointer font-normal">
                Enable negative marking
              </Label>
            </div>

            {negativeMarkingEnabled ? (
              <div className="space-y-2">
                <Label htmlFor="edit-negativeMarksPerWrongAnswer">Marks per wrong answer</Label>
                <Input
                  id="edit-negativeMarksPerWrongAnswer"
                  type="number"
                  min={MIN_NEGATIVE_MARKS}
                  max={MAX_NEGATIVE_MARKS}
                  step="0.01"
                  disabled={isSubmitting}
                  {...register('negativeMarksPerWrongAnswer')}
                />
                {errors.negativeMarksPerWrongAnswer ? (
                  <p className="text-sm text-destructive">{errors.negativeMarksPerWrongAnswer.message}</p>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <input
                id="edit-randomizeQuestions"
                type="checkbox"
                className="size-4 rounded border-input"
                disabled={isSubmitting}
                {...register('randomizeQuestions')}
              />
              <Label htmlFor="edit-randomizeQuestions" className="cursor-pointer font-normal">
                Randomize question order
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="edit-showResultImmediately"
                type="checkbox"
                className="size-4 rounded border-input"
                disabled={isSubmitting}
                {...register('showResultImmediately')}
              />
              <Label htmlFor="edit-showResultImmediately" className="cursor-pointer font-normal">
                Show result immediately after grading
              </Label>
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

export { EditAssessmentDialog };
