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

import { useCreateAssessmentMutation } from '../hooks';

// Mirrors backend/src/constants/assessment.ts's caps exactly.
const MAX_TITLE_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_INSTRUCTIONS_LENGTH = 5000;
const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 600;
const MIN_NEGATIVE_MARKS = 0;
const MAX_NEGATIVE_MARKS = 100;

// Numeric fields are kept as raw strings (matching the native <input type="number"> value) and
// converted at submit time — avoids a zod `preprocess` mismatch between the resolver's
// input/output types under react-hook-form's `useForm<T>` generic (see create-group-dialog.tsx).
const createAssessmentSchema = z
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
type CreateAssessmentFormValues = z.infer<typeof createAssessmentSchema>;

export interface CreateAssessmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** An assessment always starts DRAFT server-side, so there's deliberately no status field here. */
function CreateAssessmentDialog({ open, onOpenChange }: CreateAssessmentDialogProps) {
  const createAssessment = useCreateAssessmentMutation();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateAssessmentFormValues>({
    resolver: zodResolver(createAssessmentSchema),
    defaultValues: {
      negativeMarkingEnabled: false,
      randomizeQuestions: false,
      showResultImmediately: true,
    },
  });

  const negativeMarkingEnabled = useWatch({ control, name: 'negativeMarkingEnabled' });

  const onSubmit = async (values: CreateAssessmentFormValues) => {
    try {
      await createAssessment.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        durationMinutes: Number(values.durationMinutes),
        passingPercentage: Number(values.passingPercentage),
        availableFrom: values.availableFrom ? new Date(values.availableFrom).toISOString() : undefined,
        dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
        instructions: values.instructions || undefined,
        negativeMarkingEnabled: values.negativeMarkingEnabled,
        negativeMarksPerWrongAnswer:
          values.negativeMarkingEnabled && values.negativeMarksPerWrongAnswer
            ? Number(values.negativeMarksPerWrongAnswer)
            : undefined,
        randomizeQuestions: values.randomizeQuestions,
        showResultImmediately: values.showResultImmediately,
      });
      toast.success('Assessment created successfully.');
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
          <DialogTitle>Create Assessment</DialogTitle>
          <DialogDescription>Set up a new assessment. It starts as a draft.</DialogDescription>
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
            {errors.description ? <p className="text-sm text-destructive">{errors.description.message}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="durationMinutes">Duration (minutes)</Label>
              <Input
                id="durationMinutes"
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
              <Label htmlFor="passingPercentage">Passing percentage</Label>
              <Input
                id="passingPercentage"
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
              <Label htmlFor="availableFrom">Available from</Label>
              <Input id="availableFrom" type="datetime-local" disabled={isSubmitting} {...register('availableFrom')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" type="datetime-local" disabled={isSubmitting} {...register('dueDate')} />
              {errors.dueDate ? <p className="text-sm text-destructive">{errors.dueDate.message}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea id="instructions" rows={3} disabled={isSubmitting} {...register('instructions')} />
            {errors.instructions ? <p className="text-sm text-destructive">{errors.instructions.message}</p> : null}
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <input
                id="negativeMarkingEnabled"
                type="checkbox"
                className="size-4 rounded border-input"
                disabled={isSubmitting}
                {...register('negativeMarkingEnabled')}
              />
              <Label htmlFor="negativeMarkingEnabled" className="cursor-pointer font-normal">
                Enable negative marking
              </Label>
            </div>

            {negativeMarkingEnabled ? (
              <div className="space-y-2">
                <Label htmlFor="negativeMarksPerWrongAnswer">Marks per wrong answer</Label>
                <Input
                  id="negativeMarksPerWrongAnswer"
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
                id="randomizeQuestions"
                type="checkbox"
                className="size-4 rounded border-input"
                disabled={isSubmitting}
                {...register('randomizeQuestions')}
              />
              <Label htmlFor="randomizeQuestions" className="cursor-pointer font-normal">
                Randomize question order
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="showResultImmediately"
                type="checkbox"
                className="size-4 rounded border-input"
                disabled={isSubmitting}
                {...register('showResultImmediately')}
              />
              <Label htmlFor="showResultImmediately" className="cursor-pointer font-normal">
                Show result immediately after grading
              </Label>
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

export { CreateAssessmentDialog };
