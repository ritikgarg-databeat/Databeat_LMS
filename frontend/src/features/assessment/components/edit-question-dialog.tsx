// Edit dialog for the question bank. Mirrors create-question-dialog.tsx's type-conditional field
// set (see that file's top comment for why the logic is duplicated rather than shared), with two
// differences: `type` is immutable after creation (the backend rejects changing it — shown here
// as a read-only `QuestionTypeBadge`, not an editable `<select>`), and it fetches the full
// `Question` (with `options`/`correctAnswers`) itself via `useQuestionQuery`, since the list page
// only has the lighter `QuestionSummary` (which omits those fields) to hand it.
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/utils/error';

import { useQuestionQuery, useUpdateQuestionMutation } from '../hooks';
import type { Question, QuestionCategory, QuestionDifficulty, QuestionType, UpdateQuestionPayload } from '../types';

import { QuestionTypeBadge } from './question-type-badge';

// See create-question-dialog.tsx for why this is duplicated rather than imported from there.
const QUESTION_CATEGORY_VALUES = [
  'PYTHON',
  'SQL',
  'STATISTICS',
  'DATA_ANALYTICS',
  'MACHINE_LEARNING',
  'POWER_BI',
  'EXCEL',
  'SPARK',
  'HADOOP',
  'GENERAL',
] as const satisfies readonly QuestionCategory[];

const QUESTION_CATEGORY_LABEL: Record<QuestionCategory, string> = {
  PYTHON: 'Python',
  SQL: 'SQL',
  STATISTICS: 'Statistics',
  DATA_ANALYTICS: 'Data Analytics',
  MACHINE_LEARNING: 'Machine Learning',
  POWER_BI: 'Power BI',
  EXCEL: 'Excel',
  SPARK: 'Spark',
  HADOOP: 'Hadoop',
  GENERAL: 'General',
};

const QUESTION_DIFFICULTY_VALUES = ['EASY', 'MEDIUM', 'HARD'] as const satisfies readonly QuestionDifficulty[];

const QUESTION_DIFFICULTY_LABEL: Record<QuestionDifficulty, string> = {
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
};

const OPTION_TYPES = new Set<QuestionType>(['SINGLE_CORRECT_MCQ', 'MULTIPLE_CORRECT', 'TRUE_FALSE']);
const ANSWER_LIST_TYPES = new Set<QuestionType>(['FILL_IN_THE_BLANK', 'SQL_QUERY']);

function isOptionType(type: QuestionType): boolean {
  return OPTION_TYPES.has(type);
}

function isAnswerListType(type: QuestionType): boolean {
  return ANSWER_LIST_TYPES.has(type);
}

function isCodeSnippetType(type: QuestionType): boolean {
  return type === 'CODE_SNIPPET';
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

function getDefaultOptionsForType(type: QuestionType): { text: string; isCorrect: boolean }[] {
  if (type === 'TRUE_FALSE') {
    return [
      { text: 'True', isCorrect: true },
      { text: 'False', isCorrect: false },
    ];
  }
  if (type === 'SINGLE_CORRECT_MCQ' || type === 'MULTIPLE_CORRECT') {
    return [
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ];
  }
  return [];
}

function getDefaultAnswersForType(type: QuestionType): { value: string }[] {
  return isAnswerListType(type) ? [{ value: '' }] : [];
}

const questionFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required.').max(4000, 'Title must be 4000 characters or fewer.'),
    type: z.string().min(1, 'Type is required.'),
    category: z.string().min(1, 'Category is required.'),
    difficulty: z.string().min(1, 'Difficulty is required.'),
    explanation: z.string().max(4000, 'Explanation must be 4000 characters or fewer.').optional(),
    options: z.array(z.object({ text: z.string(), isCorrect: z.boolean() })),
    correctAnswers: z.array(z.object({ value: z.string() })),
    starterCode: z.string().optional(),
    language: z.string().max(100, 'Language must be 100 characters or fewer.').optional(),
  })
  .superRefine((values, ctx) => {
    const type = values.type as QuestionType;

    if (isOptionType(type)) {
      if (values.options.length < MIN_OPTIONS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: `At least ${MIN_OPTIONS} options are required.`,
        });
      } else if (values.options.length > MAX_OPTIONS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: `At most ${MAX_OPTIONS} options are allowed.`,
        });
      }

      if (type === 'TRUE_FALSE' && values.options.length !== 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: 'True/False requires exactly 2 options.',
        });
      }

      if (type !== 'TRUE_FALSE') {
        values.options.forEach((option, index) => {
          if (!option.text.trim()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['options', index, 'text'],
              message: 'Option text is required.',
            });
          }
        });
      }

      const correctCount = values.options.filter((option) => option.isCorrect).length;
      if (type === 'MULTIPLE_CORRECT') {
        if (correctCount < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['options'],
            message: 'Select at least one correct option.',
          });
        }
      } else if (correctCount !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: 'Select exactly one correct option.',
        });
      }
    }

    if (isAnswerListType(type)) {
      if (values.correctAnswers.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['correctAnswers'],
          message: 'At least one accepted answer is required.',
        });
      }
      values.correctAnswers.forEach((answer, index) => {
        if (!answer.value.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['correctAnswers', index, 'value'],
            message: 'Answer is required.',
          });
        }
      });
    }
  });
type QuestionFormValues = z.infer<typeof questionFormSchema>;

export interface EditQuestionDialogProps {
  questionId: string | null;
  onOpenChange: (open: boolean) => void;
}

function EditQuestionDialog({ questionId, onOpenChange }: EditQuestionDialogProps) {
  const { data: question, isLoading, isError } = useQuestionQuery(questionId ?? undefined);

  if (questionId === null) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Question</DialogTitle>
          <DialogDescription>Type cannot be changed after a question is created.</DialogDescription>
        </DialogHeader>

        {isLoading || !question ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Failed to load this question.</p>
        ) : (
          // Keyed by question.id so a fresh `EditQuestionForm` (and fresh `useForm()` call) mounts
          // per question, seeded with `defaultValues` computed directly from already-resolved data.
          // Deliberately NOT the previous single-instance-with-`values`-resync approach: a
          // Controller-bound Select whose `value` starts `undefined` (before resync applies) and
          // is corrected a tick later never actually reflects the correction in practice — Radix
          // logs "Select is changing from uncontrolled to controlled" and the trigger stays stuck
          // on its placeholder indefinitely (confirmed live: Category/Difficulty never hydrated,
          // even 3+ seconds and several re-renders later). Native `<select {...register()}>` never
          // hit this because register's `ref` writes the DOM value imperatively, bypassing the
          // render-cycle gap entirely — that safety net doesn't carry over to a custom `Select`.
          <EditQuestionForm key={question.id} question={question} onOpenChange={onOpenChange} />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface EditQuestionFormProps {
  question: Question;
  onOpenChange: (open: boolean) => void;
}

function EditQuestionForm({ question, onOpenChange }: EditQuestionFormProps) {
  const updateQuestion = useUpdateQuestionMutation();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      title: question.title,
      type: question.type,
      category: question.category,
      difficulty: question.difficulty,
      explanation: question.explanation ?? '',
      options: question.options.length
        ? question.options
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((option) => ({ text: option.text, isCorrect: option.isCorrect }))
        : getDefaultOptionsForType(question.type),
      correctAnswers: question.correctAnswers?.length
        ? question.correctAnswers.map((value) => ({ value }))
        : getDefaultAnswersForType(question.type),
      starterCode: question.starterCode ?? '',
      language: question.language ?? '',
    },
  });

  // `useWatch` (a real hook), not `watch()` (a closure off `useForm`) — see
  // lesson-resource-manager.tsx for why: the latter trips the React Compiler's
  // "incompatible library" lint rule since it can't verify the closure is safe to memoize.
  const watchedOptions = useWatch({ control, name: 'options' });

  const optionsFieldArray = useFieldArray({ control, name: 'options' });
  const answersFieldArray = useFieldArray({ control, name: 'correctAnswers' });

  const selectSingleCorrectOption = (index: number) => {
    optionsFieldArray.fields.forEach((_, fieldIndex) => {
      setValue(`options.${fieldIndex}.isCorrect`, fieldIndex === index, { shouldValidate: true });
    });
  };

  const onSubmit = async (values: QuestionFormValues) => {
    const type = question.type;

    const payload: UpdateQuestionPayload = {
      title: values.title,
      category: values.category as QuestionCategory,
      difficulty: values.difficulty as QuestionDifficulty,
      explanation: (values.explanation ?? '').trim() || null,
    };

    if (isOptionType(type)) {
      payload.options = values.options.map((option, index) => ({
        text: type === 'TRUE_FALSE' ? (index === 0 ? 'True' : 'False') : option.text.trim(),
        isCorrect: option.isCorrect,
      }));
    } else if (isAnswerListType(type)) {
      payload.correctAnswers = values.correctAnswers.map((answer) => answer.value.trim());
    } else if (isCodeSnippetType(type)) {
      payload.starterCode = (values.starterCode ?? '').trim() || null;
      payload.language = (values.language ?? '').trim() || null;
    }

    try {
      await updateQuestion.mutateAsync({ id: question.id, payload });
      toast.success('Question updated successfully.');
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const optionsError = errors.options?.message;
  const answersError = errors.correctAnswers?.message;
  const isMultipleCorrect = question.type === 'MULTIPLE_CORRECT';
  const isFixedTrueFalse = question.type === 'TRUE_FALSE';

  return (
    <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
      <div className="space-y-2">
        <Label htmlFor="edit-title">Title</Label>
        <Textarea id="edit-title" rows={3} disabled={isSubmitting} {...register('title')} />
        {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium leading-none">Type</p>
          <div className="flex h-9 items-center">
            <QuestionTypeBadge type={question.type} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-category">Category</Label>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                <SelectTrigger id="edit-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_CATEGORY_VALUES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {QUESTION_CATEGORY_LABEL[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-difficulty">Difficulty</Label>
          <Controller
            name="difficulty"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                <SelectTrigger id="edit-difficulty">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_DIFFICULTY_VALUES.map((difficulty) => (
                    <SelectItem key={difficulty} value={difficulty}>
                      {QUESTION_DIFFICULTY_LABEL[difficulty]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {isOptionType(question.type) ? (
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="space-y-2">
                  {optionsFieldArray.fields.map((field, index) => {
                    const textError = errors.options?.[index]?.text?.message;
                    return (
                      <div key={field.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          {isMultipleCorrect ? (
                            <input
                              type="checkbox"
                              className="size-4 shrink-0"
                              disabled={isSubmitting}
                              aria-label={`Mark option ${index + 1} as correct`}
                              {...register(`options.${index}.isCorrect`)}
                            />
                          ) : (
                            <input
                              type="radio"
                              name="edit-question-correct-option"
                              className="size-4 shrink-0"
                              disabled={isSubmitting}
                              aria-label={`Mark option ${index + 1} as correct`}
                              checked={Boolean(watchedOptions?.[index]?.isCorrect)}
                              onChange={() => selectSingleCorrectOption(index)}
                            />
                          )}
                          {isFixedTrueFalse ? (
                            <span className="flex-1 text-sm font-medium">{index === 0 ? 'True' : 'False'}</span>
                          ) : (
                            <Input
                              className="flex-1"
                              placeholder={`Option ${index + 1}`}
                              disabled={isSubmitting}
                              {...register(`options.${index}.text`)}
                            />
                          )}
                          {!isFixedTrueFalse ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={isSubmitting || optionsFieldArray.fields.length <= MIN_OPTIONS}
                              aria-label={`Remove option ${index + 1}`}
                              onClick={() => optionsFieldArray.remove(index)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                        {textError ? <p className="pl-6 text-sm text-destructive">{textError}</p> : null}
                      </div>
                    );
                  })}
                </div>

                {!isFixedTrueFalse ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSubmitting || optionsFieldArray.fields.length >= MAX_OPTIONS}
                    onClick={() => optionsFieldArray.append({ text: '', isCorrect: false })}
                  >
                    <Plus className="size-4" />
                    Add option
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    True/False questions always have exactly these two options.
                  </p>
                )}

                <p className="text-sm text-muted-foreground">
                  {isMultipleCorrect ? 'Check every option that is correct.' : 'Select the one correct option.'}
                </p>

                {optionsError ? <p className="text-sm text-destructive">{optionsError}</p> : null}
              </div>
            ) : null}

            {isAnswerListType(question.type) ? (
              <div className="space-y-2">
                <Label>Accepted answers</Label>
                <div className="space-y-2">
                  {answersFieldArray.fields.map((field, index) => {
                    const valueError = errors.correctAnswers?.[index]?.value?.message;
                    return (
                      <div key={field.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Input
                            className="flex-1"
                            placeholder={`Accepted answer ${index + 1}`}
                            disabled={isSubmitting}
                            {...register(`correctAnswers.${index}.value`)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={isSubmitting || answersFieldArray.fields.length <= 1}
                            aria-label={`Remove accepted answer ${index + 1}`}
                            onClick={() => answersFieldArray.remove(index)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        {valueError ? <p className="text-sm text-destructive">{valueError}</p> : null}
                      </div>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => answersFieldArray.append({ value: '' })}
                >
                  <Plus className="size-4" />
                  Or accept another answer
                </Button>
                {answersError ? <p className="text-sm text-destructive">{answersError}</p> : null}
              </div>
            ) : null}

            {isCodeSnippetType(question.type) ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="edit-starterCode">Starter code (optional)</Label>
                  <Textarea
                    id="edit-starterCode"
                    rows={6}
                    className="font-mono text-sm"
                    disabled={isSubmitting}
                    {...register('starterCode')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-language">Language (optional)</Label>
                  <Input
                    id="edit-language"
                    placeholder="e.g. python"
                    disabled={isSubmitting}
                    {...register('language')}
                  />
                  {errors.language ? <p className="text-sm text-destructive">{errors.language.message}</p> : null}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="edit-explanation">Explanation (optional)</Label>
              <Textarea id="edit-explanation" rows={3} disabled={isSubmitting} {...register('explanation')} />
              {errors.explanation ? <p className="text-sm text-destructive">{errors.explanation.message}</p> : null}
            </div>

      <DialogFooter>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save changes'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export { EditQuestionDialog };
