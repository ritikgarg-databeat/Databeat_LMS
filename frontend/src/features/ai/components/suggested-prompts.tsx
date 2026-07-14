// Canned starting points shown above the input box for a brand-new (empty) conversation. Purely
// presentational — the parent page owns actually sending the message via `onSelect`.
import type { LucideIcon } from 'lucide-react';
import { HelpCircle, Lightbulb, ListChecks, MessageCircleQuestion, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { AiExplanationLevel, AiFeature } from '../types';

export interface SuggestedPromptsProps {
  onSelect: (feature: AiFeature, explanationLevel: AiExplanationLevel | undefined, promptText: string) => void;
  /** Whether this conversation is scoped to a lesson. Suggestions are useful either way — a
   * plain CHAT-mode conversation still benefits from these prompts, the backend's system prompt
   * just won't have lesson-specific material to draw from. Only used to tweak the lead-in copy. */
  hasLessonContext: boolean;
}

interface Suggestion {
  label: string;
  feature: AiFeature;
  explanationLevel?: AiExplanationLevel;
  /** Sent verbatim as the message text when clicked. */
  promptText: string;
  icon: LucideIcon;
}

const SUGGESTIONS: Suggestion[] = [
  {
    label: 'Explain this simply',
    feature: 'EXPLAIN_TOPIC',
    explanationLevel: 'BEGINNER',
    promptText: 'Explain this topic simply.',
    icon: Lightbulb,
  },
  {
    label: 'Explain in detail',
    feature: 'EXPLAIN_TOPIC',
    explanationLevel: 'DETAILED',
    promptText: 'Give me a detailed explanation.',
    icon: Sparkles,
  },
  {
    label: 'Summarize this lesson',
    feature: 'SUMMARIZE_LESSON',
    promptText: 'Summarize this lesson.',
    icon: ListChecks,
  },
  {
    label: 'Show me examples',
    feature: 'GENERATE_EXAMPLES',
    promptText: 'Generate some practical examples.',
    icon: HelpCircle,
  },
  {
    label: 'Generate practice questions',
    feature: 'GENERATE_PRACTICE_QUESTIONS',
    promptText: 'Generate some practice questions for this topic.',
    icon: ListChecks,
  },
];

function SuggestedPrompts({ onSelect, hasLessonContext }: SuggestedPromptsProps) {
  return (
    <div className="space-y-2 rounded-lg border border-dashed p-4">
      <p className="text-sm text-muted-foreground">
        {hasLessonContext ? 'Get started with a suggestion for this lesson:' : 'Get started with a suggestion:'}
      </p>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelect(suggestion.feature, suggestion.explanationLevel, suggestion.promptText)}
          >
            <suggestion.icon className="size-3.5" />
            {suggestion.label}
          </Button>
        ))}
        {/* Generic fallback — focuses the input instead of auto-sending a canned prompt. */}
        <Button type="button" variant="outline" size="sm" onClick={() => onSelect('CHAT', undefined, '')}>
          <MessageCircleQuestion className="size-3.5" />
          Ask a question
        </Button>
      </div>
    </div>
  );
}

export { SuggestedPrompts };
