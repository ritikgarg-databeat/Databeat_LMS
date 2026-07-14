// Renders the appropriate answer control for one attempt question, branching on
// `question.snapshotType`. Fully controlled by `value`/`onChange` — the parent
// (`AssessmentPlayerPage`) owns all answer state, seeded once from `savedAnswer` on load, so this
// component never needs to distinguish "first render" from "re-render": the CODE_SNIPPET
// starter-code prefill and every other type's `savedAnswer` prefill both happen once, upstream,
// when the parent seeds its answers map from the attempt-start response.
import type { ChangeEvent } from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import type { SanitizedAttemptQuestion } from '../types';

export interface QuestionRendererProps {
  question: SanitizedAttemptQuestion;
  /** A single selected option id (SINGLE_CORRECT_MCQ/TRUE_FALSE), an array of ids
   * (MULTIPLE_CORRECT), or free text (every other non-file type). Always `string | string[]` —
   * FILE_UPLOAD never reports through here, it uses `onFileSelect` instead. */
  value: string | string[];
  onChange: (value: string | string[]) => void;
  /** FILE_UPLOAD only. Fires immediately on file pick — no debounce, unlike text/MCQ `onChange`. */
  onFileSelect?: (file: File) => void;
  disabled?: boolean;
}

/** Branches on `snapshotType` to render the right input for a trainee taking an assessment. */
function QuestionRenderer({ question, value, onChange, onFileSelect, disabled = false }: QuestionRendererProps) {
  const { snapshotType, snapshotOptions } = question;

  if (snapshotType === 'SINGLE_CORRECT_MCQ' || snapshotType === 'TRUE_FALSE') {
    const selected = typeof value === 'string' ? value : '';
    return (
      <div className="space-y-2" role="radiogroup" aria-label={question.snapshotTitle}>
        {(snapshotOptions ?? []).map((option) => (
          <label
            key={option.id}
            className={cn(
              'flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm transition-colors hover:bg-accent',
              selected === option.id && 'border-primary bg-accent',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              type="radio"
              className="mt-0.5"
              name={`question-${question.id}`}
              value={option.id}
              checked={selected === option.id}
              disabled={disabled}
              onChange={() => onChange(option.id)}
            />
            <span>{option.text}</span>
          </label>
        ))}
      </div>
    );
  }

  if (snapshotType === 'MULTIPLE_CORRECT') {
    const selected = Array.isArray(value) ? value : [];
    const toggle = (optionId: string) => {
      onChange(
        selected.includes(optionId) ? selected.filter((id) => id !== optionId) : [...selected, optionId],
      );
    };
    return (
      <div className="space-y-2">
        {(snapshotOptions ?? []).map((option) => (
          <label
            key={option.id}
            className={cn(
              'flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm transition-colors hover:bg-accent',
              selected.includes(option.id) && 'border-primary bg-accent',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={selected.includes(option.id)}
              disabled={disabled}
              onChange={() => toggle(option.id)}
            />
            <span>{option.text}</span>
          </label>
        ))}
      </div>
    );
  }

  if (snapshotType === 'FILL_IN_THE_BLANK') {
    const text = typeof value === 'string' ? value : '';
    return (
      <Input
        value={text}
        disabled={disabled}
        placeholder="Type your answer..."
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
    );
  }

  if (snapshotType === 'SHORT_ANSWER' || snapshotType === 'SQL_QUERY') {
    const text = typeof value === 'string' ? value : '';
    return (
      <Textarea
        value={text}
        disabled={disabled}
        rows={snapshotType === 'SQL_QUERY' ? 6 : 3}
        placeholder={snapshotType === 'SQL_QUERY' ? 'Write your SQL query...' : 'Type your answer...'}
        className={cn(snapshotType === 'SQL_QUERY' && 'font-mono text-sm')}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (snapshotType === 'LONG_ANSWER') {
    const text = typeof value === 'string' ? value : '';
    return (
      <Textarea
        value={text}
        disabled={disabled}
        rows={8}
        placeholder="Write your answer..."
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (snapshotType === 'CODE_SNIPPET') {
    const text = typeof value === 'string' ? value : '';
    return (
      <div className="space-y-1">
        {question.snapshotLanguage ? (
          <p className="text-xs text-muted-foreground">Language: {question.snapshotLanguage}</p>
        ) : null}
        <Textarea
          value={text}
          disabled={disabled}
          spellCheck={false}
          className="min-h-48 font-mono text-sm"
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  if (snapshotType === 'FILE_UPLOAD') {
    const currentFilename = typeof value === 'string' && value.length > 0 ? value : null;
    return (
      <div className="space-y-2">
        {currentFilename ? (
          <p className="text-sm text-muted-foreground">
            Currently uploaded: <span className="font-medium text-foreground">{currentFilename}</span> — choose a
            new file to replace it.
          </p>
        ) : null}
        <Input
          type="file"
          disabled={disabled}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (file) onFileSelect?.(file);
            // Reset so re-selecting the same filename after a failed upload still fires onChange.
            event.target.value = '';
          }}
        />
      </div>
    );
  }

  return null;
}

export { QuestionRenderer };
