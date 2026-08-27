// @dnd-kit reorderable answer-key list for one assessment — structurally the single-level
// counterpart to classroom's module-lesson-tree.tsx (which nests two levels).
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/error';

import {
  useAssessmentQuestionsQuery,
  useRemoveQuestionMutation,
  useReorderQuestionsMutation,
  useUpdateAssessmentQuestionMutation,
} from '../hooks';
import type { AssessmentQuestion } from '../types';

import { QuestionTypeBadge } from './question-type-badge';

const MIN_MARKS = 1;
const MAX_MARKS = 1000;

export interface AssessmentQuestionListProps {
  assessmentId: string;
  readOnly?: boolean;
}

function AssessmentQuestionList({ assessmentId, readOnly = false }: AssessmentQuestionListProps) {
  const [deletingQuestion, setDeletingQuestion] = useState<AssessmentQuestion | null>(null);

  const { data: questions, isLoading, isError, refetch } = useAssessmentQuestionsQuery(assessmentId);
  const reorderQuestions = useReorderQuestionsMutation();
  const updateQuestion = useUpdateAssessmentQuestionMutation();
  const removeQuestion = useRemoveQuestionMutation();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sortedQuestions = useMemo(
    () => [...(questions ?? [])].sort((a, b) => a.order - b.order),
    [questions],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (readOnly) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedQuestions.findIndex((question) => question.id === active.id);
    const newIndex = sortedQuestions.findIndex((question) => question.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sortedQuestions, oldIndex, newIndex);
    // The backend requires the full, exact set of this assessment's question ids on every
    // reorder call — `reordered` always is that full set since it's just `sortedQuestions` moved.
    reorderQuestions.mutate(
      { assessmentId, payload: { orderedIds: reordered.map((question) => question.id) } },
      { onError: (error) => toast.error(getErrorMessage(error)) },
    );
  };

  const handleMarksChange = (question: AssessmentQuestion, marks: number) => {
    if (!Number.isInteger(marks) || marks < MIN_MARKS || marks > MAX_MARKS || marks === question.marks)
      return;
    updateQuestion.mutate(
      { assessmentId, aqId: question.id, payload: { marks } },
      { onError: (error) => toast.error(getErrorMessage(error)) },
    );
  };

  const handleDelete = async () => {
    if (!deletingQuestion) return;
    try {
      await removeQuestion.mutateAsync({ assessmentId, aqId: deletingQuestion.id });
      toast.success('Question removed.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingQuestion(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Failed to load questions.{' '}
        <button type="button" className="underline" onClick={() => void refetch()}>
          Retry
        </button>
      </p>
    );
  }

  if (sortedQuestions.length === 0) {
    return (
      <EmptyState title="No questions yet" description="Add a question to start building this assessment." />
    );
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={sortedQuestions.map((question) => question.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {sortedQuestions.map((question, index) => (
              <SortableQuestionRow
                key={question.id}
                question={question}
                position={index + 1}
                readOnly={readOnly}
                onMarksChange={(marks) => handleMarksChange(question, marks)}
                onDelete={() => setDeletingQuestion(question)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <ConfirmDialog
        open={deletingQuestion !== null}
        onOpenChange={(open) => !open && setDeletingQuestion(null)}
        title="Remove question"
        description={
          deletingQuestion
            ? `${deletingQuestion.snapshotTitle} will be removed from this assessment. This cannot be undone.`
            : undefined
        }
        confirmLabel="Remove"
        destructive
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}

interface SortableQuestionRowProps {
  question: AssessmentQuestion;
  position: number;
  readOnly: boolean;
  onMarksChange: (marks: number) => void;
  onDelete: () => void;
}

function SortableQuestionRow({
  question,
  position,
  readOnly,
  onMarksChange,
  onDelete,
}: SortableQuestionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-md border bg-card p-3',
        isDragging && 'opacity-50 shadow-lg',
      )}
    >
      <button
        type="button"
        className={cn(
          'touch-none text-muted-foreground',
          readOnly ? 'cursor-default opacity-40' : 'cursor-grab hover:text-foreground active:cursor-grabbing',
        )}
        disabled={readOnly}
        aria-label={`Drag to reorder ${question.snapshotTitle}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      <span className="w-6 shrink-0 text-center text-sm font-medium text-muted-foreground">{position}</span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{question.snapshotTitle}</p>
        <QuestionTypeBadge type={question.snapshotType} className="mt-1" />
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor={`aq-marks-${question.id}`} className="text-xs text-muted-foreground">
          Marks
        </Label>
        <Input
          // Uncontrolled + keyed on `marks` — remounts (picking up the fresh `defaultValue`)
          // whenever `marks` changes from outside this row (e.g. after a successful save, or a
          // refetch triggered elsewhere), without needing a state-syncing effect.
          key={question.marks}
          id={`aq-marks-${question.id}`}
          type="number"
          min={MIN_MARKS}
          max={MAX_MARKS}
          className="w-20"
          defaultValue={question.marks}
          disabled={readOnly}
          onBlur={(event) => onMarksChange(Number(event.target.value))}
        />
      </div>

      {!readOnly ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remove ${question.snapshotTitle}`}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

export { AssessmentQuestionList };
