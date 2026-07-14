import { X } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';

import { useQnaTagsQuery } from '../hooks';

/** Mirrors the backend's MAX_QNA_TAGS_PER_QUESTION constant — not imported since this is a frontend-only feature folder. */
const DEFAULT_MAX_TAGS = 5;
/** Mirrors the backend's per-tag length cap — a client-side sanity check only; the backend does its own trim/dedupe. */
const MAX_TAG_LENGTH = 50;

export interface TagPickerProps {
  value: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
  className?: string;
}

/**
 * Chip-style tag input: type + press Enter/comma to add, click "x" to remove, with a debounced
 * `useQnaTagsQuery` autocomplete dropdown of existing matching tags below the input.
 */
function TagPicker({ value, onChange, maxTags = DEFAULT_MAX_TAGS, className }: TagPickerProps) {
  const [inputValue, setInputValue] = useState('');
  const debouncedInput = useDebounce(inputValue, 300);
  const { data: suggestions } = useQnaTagsQuery(debouncedInput ? { search: debouncedInput } : undefined);

  const atLimit = value.length >= maxTags;

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag || tag.length > MAX_TAG_LENGTH || atLimit || value.includes(tag)) return;
    onChange([...value, tag]);
    setInputValue('');
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((existing) => existing !== tag));
  };

  const filteredSuggestions = (suggestions ?? []).filter((tag) => !value.includes(tag.name)).slice(0, 8);

  return (
    <div className={cn('space-y-2', className)}>
      {value.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 font-normal">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
                className="rounded-full hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <Input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              addTag(inputValue);
            } else if (event.key === 'Backspace' && !inputValue && value.length > 0) {
              removeTag(value[value.length - 1] as string);
            }
          }}
          placeholder={atLimit ? `Maximum ${maxTags} tags reached` : 'Type a tag and press Enter...'}
          disabled={atLimit}
          maxLength={MAX_TAG_LENGTH}
        />
        {inputValue && filteredSuggestions.length > 0 ? (
          <ul className="absolute z-10 mt-1 w-full rounded-md border bg-popover p-1 text-sm shadow-md">
            {filteredSuggestions.map((tag) => (
              <li key={tag.id}>
                <button
                  type="button"
                  className="w-full rounded-sm px-2 py-1.5 text-left hover:bg-accent"
                  onClick={() => addTag(tag.name)}
                >
                  {tag.name}
                  <span className="ml-1 text-xs text-muted-foreground">({tag.questionCount})</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        {value.length}/{maxTags} tags{atLimit ? ' — maximum reached' : ''}
      </p>
    </div>
  );
}

export { TagPicker };
