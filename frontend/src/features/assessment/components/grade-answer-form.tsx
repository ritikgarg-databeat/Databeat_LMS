// Inline marks-entry form for one manual-review answer (SHORT_ANSWER/LONG_ANSWER/CODE_SNIPPET/
// FILE_UPLOAD). Rendered by `AttemptGradingPage` only for answers still awaiting grading
// (`marksAwarded === null`) — once graded, the page swaps this out for a read-only display.
import type { FormEvent } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage } from '@/utils/error';

import { useGradeAnswerMutation } from '../hooks';

export interface GradeAnswerFormProps {
  assessmentId: string;
  attemptId: string;
  answerId: string;
  /** The question's `marks` — the ceiling the trainer can award for this answer. */
  maxMarks: number;
}

/**
 * Marks-only grading form. `isCorrect` is derived implicitly (`marksAwarded > 0`) rather than
 * exposed as a separate toggle — for these free-form question types "correct" is really just
 * "the trainer awarded some credit", so a second control would be redundant busywork.
 */
function GradeAnswerForm({ assessmentId, attemptId, answerId, maxMarks }: GradeAnswerFormProps) {
  const [marksAwarded, setMarksAwarded] = useState('');
  const gradeAnswer = useGradeAnswerMutation();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsed = Number(marksAwarded);
    if (marksAwarded.trim() === '' || Number.isNaN(parsed) || parsed < 0 || parsed > maxMarks) {
      toast.error(`Enter a value between 0 and ${maxMarks}.`);
      return;
    }

    try {
      await gradeAnswer.mutateAsync({
        assessmentId,
        attemptId,
        answerId,
        payload: { marksAwarded: parsed, isCorrect: parsed > 0 },
      });
      toast.success('Grade saved.');
      setMarksAwarded('');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor={`marks-${answerId}`}>Marks awarded</Label>
        <div className="flex items-center gap-2">
          <Input
            id={`marks-${answerId}`}
            type="number"
            min={0}
            max={maxMarks}
            step="any"
            value={marksAwarded}
            onChange={(event) => setMarksAwarded(event.target.value)}
            className="w-24"
            disabled={gradeAnswer.isPending}
          />
          <span className="text-sm text-muted-foreground">/ {maxMarks}</span>
        </div>
      </div>
      <Button type="submit" size="sm" disabled={gradeAnswer.isPending}>
        {gradeAnswer.isPending ? 'Saving...' : 'Save grade'}
      </Button>
    </form>
  );
}

export { GradeAnswerForm };
