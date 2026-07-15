// Create dialog for the question bank. The trickiest part of this form is that its field set
// genuinely depends on the selected `type` — see the inline `isOptionType`/`isAnswerListType`/
// `isCodeSnippetType` helpers below, which branch the JSX between: an editable options list
// (SINGLE_CORRECT_MCQ/MULTIPLE_CORRECT), a locked True/False pair (TRUE_FALSE), a list of
// acceptable answers (FILL_IN_THE_BLANK/SQL_QUERY), optional starter code + language
// (CODE_SNIPPET), or nothing extra at all (SHORT_ANSWER/LONG_ANSWER/FILE_UPLOAD).
//
// `EditQuestionDialog` (edit-question-dialog.tsx) needs the exact same conditional field set, but
// deliberately does NOT import it from here — sharing it would force this file to export
// non-component values (schema, helpers), which trips `react-refresh/only-export-components`.
// Following the create/edit-group-dialog precedent (full duplication, not shared abstraction),
// each dialog file is self-contained; keep the two in sync if the question-type rules change.
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
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/utils/error';

import { useCreateQuestionMutation } from '../hooks';
import type { CreateQuestionPayload, QuestionCategory, QuestionDifficulty, QuestionType } from '../types';

import { QUESTION_TYPE_LABEL, QUESTION_TYPE_VALUES } from './question-type-badge';

// `QuestionCategory`/`QuestionDifficulty` don't have a label glossary in the (currently empty)
// shared `constants/index.ts` yet — defined locally here (and again in edit-question-dialog.tsx /
// question-bank-page.tsx) rather than editing that shared foundation file. Worth promoting to
// `constants/index.ts` in a follow-up once these three files land together.
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

const DEFAULT_TYPE: QuestionType = 'SINGLE_CORRECT_MCQ';

export interface CreateQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CreateQuestionDialog({ open, onOpenChange }: CreateQuestionDialogProps) {
  const createQuestion = useCreateQuestionMutation();

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      title: '',
      type: DEFAULT_TYPE,
      category: 'GENERAL',
      difficulty: 'MEDIUM',
      explanation: '',
      options: getDefaultOptionsForType(DEFAULT_TYPE),
      correctAnswers: getDefaultAnswersForType(DEFAULT_TYPE),
      starterCode: '',
      language: '',
    },
  });

  // `useWatch` (a real hook), not `watch()` (a closure off `useForm`) — see
  // lesson-resource-manager.tsx for why: the latter trips the React Compiler's
  // "incompatible library" lint rule since it can't verify the closure is safe to memoize.
  const selectedType = useWatch({ control, name: 'type' }) as QuestionType;
  const watchedOptions = useWatch({ control, name: 'options' });

  const optionsFieldArray = useFieldArray({ control, name: 'options' });
  const answersFieldArray = useFieldArray({ control, name: 'correctAnswers' });

  const handleTypeChange = (nextType: QuestionType) => {
    setValue('options', getDefaultOptionsForType(nextType));
    setValue('correctAnswers', getDefaultAnswersForType(nextType));
    if (!isCodeSnippetType(nextType)) {
      setValue('starterCode', '');
      setValue('language', '');
    }
  };

  const selectSingleCorrectOption = (index: number) => {
    optionsFieldArray.fields.forEach((_, fieldIndex) => {
      setValue(`options.${fieldIndex}.isCorrect`, fieldIndex === index, { shouldValidate: true });
    });
  };

  const onSubmit = async (values: QuestionFormValues) => {
    const type = values.type as QuestionType;

    const payload: CreateQuestionPayload = {
      title: values.title,
      type,
      category: values.category as QuestionCategory,
      difficulty: values.difficulty as QuestionDifficulty,
      explanation: (values.explanation ?? '').trim() || undefined,
    };

    if (isOptionType(type)) {
      payload.options = values.options.map((option, index) => ({
        text: type === 'TRUE_FALSE' ? (index === 0 ? 'True' : 'False') : option.text.trim(),
        isCorrect: option.isCorrect,
      }));
    } else if (isAnswerListType(type)) {
      payload.correctAnswers = values.correctAnswers.map((answer) => answer.value.trim());
    } else if (isCodeSnippetType(type)) {
      payload.starterCode = (values.starterCode ?? '').trim() || undefined;
      payload.language = (values.language ?? '').trim() || undefined;
    }

    try {
      await createQuestion.mutateAsync(payload);
      toast.success('Question created successfully.');
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  // `options`/`correctAnswers` are `useFieldArray`-registered, so a Zod issue whose path is the
  // array itself (not a specific index) — "select exactly one correct option", "at least/most N
  // options", "at least one accepted answer required" — lands on `errors.options.root`, not
  // `errors.options` directly (react-hook-form's FieldArray convention). Reading `.message`
  // instead of `.root.message` silently swallowed every one of those messages: the form just
  // failed to submit with no visible feedback at all.
  const optionsError = errors.options?.root?.message;
  const answersError = errors.correctAnswers?.root?.message;
  const isMultipleCorrect = selectedType === 'MULTIPLE_CORRECT';
  const isFixedTrueFalse = selectedType === 'TRUE_FALSE';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Question</DialogTitle>
          <DialogDescription>Add a new question to the bank.</DialogDescription>
        </DialogHeader>

        <form noValidate className="space-y-4" onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Textarea id="title" rows={3} disabled={isSubmitting} {...register('title')} />
            {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleTypeChange(value as QuestionType);
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPE_VALUES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {QUESTION_TYPE_LABEL[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Controller
                name="category"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                    <SelectTrigger id="category">
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
              <Label htmlFor="difficulty">Difficulty</Label>
              <Controller
                name="difficulty"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                    <SelectTrigger id="difficulty">
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

          {isOptionType(selectedType) ? (
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
                            name="create-question-correct-option"
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

          {isAnswerListType(selectedType) ? (
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

          {isCodeSnippetType(selectedType) ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="starterCode">Starter code (optional)</Label>
                <Textarea
                  id="starterCode"
                  rows={6}
                  className="font-mono text-sm"
                  disabled={isSubmitting}
                  {...register('starterCode')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Language (optional)</Label>
                <Input id="language" placeholder="e.g. python" disabled={isSubmitting} {...register('language')} />
                {errors.language ? <p className="text-sm text-destructive">{errors.language.message}</p> : null}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="explanation">Explanation (optional)</Label>
            <Textarea id="explanation" rows={3} disabled={isSubmitting} {...register('explanation')} />
            {errors.explanation ? <p className="text-sm text-destructive">{errors.explanation.message}</p> : null}
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

export { CreateQuestionDialog };
