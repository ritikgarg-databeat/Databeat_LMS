// Standalone "post an answer" textarea, rendered at the bottom of the question detail page.
// The parent hides/disables this entirely when the question is CLOSED (the backend 400s on
// "This question is closed and no longer accepting answers." otherwise) — SOLVED questions
// still accept new answers, so no status check happens in here.
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/utils/error';

import { useCreateAnswerMutation } from '../hooks';

export interface AnswerEditorProps {
  questionId: string;
}

function AnswerEditor({ questionId }: AnswerEditorProps) {
  const [content, setContent] = useState('');
  const createAnswer = useCreateAnswerMutation();

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    createAnswer.mutate(
      { questionId, content: trimmed },
      {
        onSuccess: () => {
          setContent('');
          toast.success('Answer posted successfully.');
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  return (
    <div className="space-y-2">
      <h2 className="text-base font-semibold">Your answer</h2>
      <Textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Write your answer... Markdown is supported."
        rows={6}
        disabled={createAnswer.isPending}
      />
      <Button type="button" onClick={handleSubmit} disabled={createAnswer.isPending || !content.trim()}>
        {createAnswer.isPending ? 'Posting...' : 'Post answer'}
      </Button>
    </div>
  );
}

export { AnswerEditor };
