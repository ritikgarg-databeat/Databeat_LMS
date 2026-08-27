// Simple single-add-at-a-time picker — pulls ACTIVE questions from the bank, excludes ones
// already on this assessment (cross-referenced by `questionId`), and lets the trainer set marks
// inline before adding. No bulk multi-select — see the Prompt 6 spec for why that's out of scope.
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { SearchBox } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/use-debounce';
import { getErrorMessage } from '@/utils/error';

import { useAddQuestionMutation, useAssessmentQuestionsQuery, useQuestionsQuery } from '../hooks';

import { QuestionTypeBadge } from './question-type-badge';

const QUESTION_PICKER_PAGE_SIZE = 50;
const DEFAULT_MARKS = 1;
const MIN_MARKS = 1;
const MAX_MARKS = 1000;

export interface AddQuestionToAssessmentDialogProps {
  assessmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AddQuestionToAssessmentDialog({
  assessmentId,
  open,
  onOpenChange,
}: AddQuestionToAssessmentDialogProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [marksByQuestionId, setMarksByQuestionId] = useState<Record<string, string>>({});
  const [pendingQuestionId, setPendingQuestionId] = useState<string | null>(null);

  const { data: bankPage, isLoading: isLoadingBank } = useQuestionsQuery({
    page: 1,
    pageSize: QUESTION_PICKER_PAGE_SIZE,
    status: 'ACTIVE',
    search: debouncedSearch || undefined,
  });
  const { data: assessmentQuestions } = useAssessmentQuestionsQuery(open ? assessmentId : undefined);

  const addQuestion = useAddQuestionMutation();

  const addedQuestionIds = useMemo(
    () =>
      new Set(
        (assessmentQuestions ?? [])
          .map((assessmentQuestion) => assessmentQuestion.questionId)
          .filter((id): id is string => id !== null),
      ),
    [assessmentQuestions],
  );

  const availableQuestions = useMemo(
    () => (bankPage?.items ?? []).filter((question) => !addedQuestionIds.has(question.id)),
    [bankPage, addedQuestionIds],
  );

  const handleAdd = async (questionId: string) => {
    const marksValue = marksByQuestionId[questionId] ?? String(DEFAULT_MARKS);
    const marks = Number(marksValue);
    if (!Number.isInteger(marks) || marks < MIN_MARKS || marks > MAX_MARKS) {
      toast.error(`Marks must be a whole number between ${MIN_MARKS} and ${MAX_MARKS}.`);
      return;
    }
    setPendingQuestionId(questionId);
    try {
      await addQuestion.mutateAsync({ assessmentId, payload: { questionId, marks } });
      toast.success('Question added.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPendingQuestionId(null);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSearch('');
      setMarksByQuestionId({});
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Question</DialogTitle>
          <DialogDescription>Pick an active question from the bank and set its marks.</DialogDescription>
        </DialogHeader>

        <SearchBox value={search} onChange={setSearch} placeholder="Search questions..." />

        {isLoadingBank ? (
          <p className="py-4 text-sm text-muted-foreground">Loading...</p>
        ) : availableQuestions.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            {debouncedSearch ? 'No matching questions found.' : 'No more active questions available to add.'}
          </p>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {availableQuestions.map((question) => {
              const isPending = pendingQuestionId === question.id;
              return (
                <div key={question.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{question.title}</p>
                    <QuestionTypeBadge type={question.type} className="mt-1" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`marks-${question.id}`} className="text-xs text-muted-foreground">
                      Marks
                    </Label>
                    <Input
                      id={`marks-${question.id}`}
                      type="number"
                      min={MIN_MARKS}
                      max={MAX_MARKS}
                      className="w-20"
                      disabled={isPending}
                      value={marksByQuestionId[question.id] ?? String(DEFAULT_MARKS)}
                      onChange={(event) =>
                        setMarksByQuestionId((previous) => ({
                          ...previous,
                          [question.id]: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={() => void handleAdd(question.id)}
                  >
                    {isPending ? 'Adding...' : 'Add'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { AddQuestionToAssessmentDialog };
