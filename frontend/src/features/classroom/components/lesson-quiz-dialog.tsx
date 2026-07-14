import { CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/error';

import { useSubmitLessonQuizMutation } from '../hooks';
import type { LessonQuizResult, SanitizedQuizQuestion } from '../types';

export interface LessonQuizDialogProps {
  lessonId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questions: SanitizedQuizQuestion[];
  /** Fired after the trainee clicks "Mark lesson as complete" on the results screen — the
   * caller (lesson-viewer-page.tsx) fires the real progress mutation, exactly as it always has. */
  onCompleted: () => void;
}

/**
 * Shown when "Mark as complete" determines this lesson requires its AI-generated completion
 * quiz first (see lesson-viewer-page.tsx#handleMarkComplete). Answer every question -> submit
 * -> see the graded result (correct answers revealed) -> "Mark lesson as complete" hands control
 * back to the caller. No retakes — once submitted, the results screen is all this dialog shows.
 */
function LessonQuizDialog({ lessonId, open, onOpenChange, questions, onCompleted }: LessonQuizDialogProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<LessonQuizResult | null>(null);
  const submitQuiz = useSubmitLessonQuizMutation();

  const allAnswered = questions.every((question) => Boolean(answers[question.id]));

  const handleSubmit = () => {
    submitQuiz.mutate(
      {
        lessonId,
        payload: {
          answers: questions.map((question) => ({
            questionId: question.id,
            selectedOptionId: answers[question.id] ?? '',
          })),
        },
      },
      {
        onSuccess: (data) => setResult(data),
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setAnswers({});
      setResult(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Quick check before you finish</DialogTitle>
          <DialogDescription>
            {result
              ? `You scored ${result.score}/${result.totalQuestions} (${result.percentage}%).`
              : 'Answer these questions about the lesson content, then mark it complete.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {questions.map((question, index) => {
            const questionResult = result?.results.find((entry) => entry.questionId === question.id);
            const showResult = Boolean(questionResult);

            return (
              <div key={question.id} className="space-y-2">
                <p className="text-sm font-medium">
                  {index + 1}. {question.text}
                </p>
                <div className="space-y-2" role="radiogroup" aria-label={question.text}>
                  {question.options.map((option) => {
                    const isSelected = answers[question.id] === option.id;
                    const isCorrectOption = questionResult?.correctOptionId === option.id;

                    return (
                      <label
                        key={option.id}
                        className={cn(
                          'flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm transition-colors',
                          !showResult && 'hover:bg-accent',
                          isSelected && !showResult && 'border-primary bg-accent',
                          showResult && isCorrectOption && 'border-success bg-success/10',
                          showResult && isSelected && !isCorrectOption && 'border-destructive bg-destructive/10',
                          showResult && 'cursor-default',
                        )}
                      >
                        <input
                          type="radio"
                          className="mt-0.5"
                          name={`quiz-question-${question.id}`}
                          value={option.id}
                          checked={isSelected}
                          disabled={showResult}
                          onChange={() => setAnswers((previous) => ({ ...previous, [question.id]: option.id }))}
                        />
                        <span className="flex-1">{option.text}</span>
                        {showResult && isCorrectOption ? (
                          <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
                        ) : null}
                        {showResult && isSelected && !isCorrectOption ? (
                          <XCircle className="size-4 shrink-0 text-destructive" aria-hidden />
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          {result ? (
            <Button type="button" onClick={onCompleted}>
              <CheckCircle2 /> Mark lesson as complete
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={!allAnswered || submitQuiz.isPending}>
              {submitQuiz.isPending ? 'Submitting...' : 'Submit quiz'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { LessonQuizDialog };
