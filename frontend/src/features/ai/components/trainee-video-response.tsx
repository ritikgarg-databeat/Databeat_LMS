import { RotateCw, Video } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { getErrorMessage } from '@/utils/error';

import { useAiVideoPreviewQuery, useAiVideoQuery, useRetryAiVideoMutation } from '../hooks';
import type { AiVideoGeneration } from '../types';

const PROCESSING = new Set(['PLANNING', 'QUEUED', 'SYNTHESIZING', 'RENDERING']);

interface TraineeVideoResponseProps {
  initialVideo: AiVideoGeneration;
}

function TraineeVideoResponse({ initialVideo }: TraineeVideoResponseProps) {
  const jobQuery = useAiVideoQuery(initialVideo.id);
  const retry = useRetryAiVideoMutation();
  const job = jobQuery.data ?? initialVideo;
  const previewQuery = useAiVideoPreviewQuery(job.id, job.status === 'READY');
  const previewUrl = useMemo(
    () => (previewQuery.data ? URL.createObjectURL(previewQuery.data) : null),
    [previewQuery.data],
  );

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  if (PROCESSING.has(job.status)) {
    return (
      <div className="w-full max-w-2xl space-y-3 rounded-2xl bg-muted p-4">
        <div className="flex items-center justify-between gap-3 text-sm font-medium">
          <span className="flex items-center gap-2">
            <Spinner className="size-4" /> Creating your lesson video
          </span>
          <span>{job.progress}%</span>
        </div>
        <Progress value={job.progress} />
        <p className="text-xs text-muted-foreground">
          You can leave this page. The video will remain in this conversation and continue in the background.
        </p>
      </div>
    );
  }

  if (job.status === 'READY') {
    return (
      <div className="w-full max-w-2xl space-y-2 rounded-2xl bg-muted p-3">
        <p className="flex items-center gap-2 px-1 text-sm font-medium">
          <Video className="size-4" /> Lesson video
        </p>
        {previewUrl ? (
          // Captions are burned into the MP4 only when word-level timing succeeds; otherwise none are shown.
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video className="aspect-video w-full rounded-lg bg-black" controls playsInline src={previewUrl} />
        ) : previewQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to load the video</AlertTitle>
            <AlertDescription>{getErrorMessage(previewQuery.error)}</AlertDescription>
          </Alert>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-lg bg-black/80">
            <Spinner />
          </div>
        )}
      </div>
    );
  }

  return (
    <Alert variant="destructive" className="w-full max-w-2xl">
      <AlertTitle>Video generation failed</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{job.error?.message ?? 'The video could not be generated. Please try again.'}</p>
        {job.status === 'FAILED' ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => retry.mutate(job.id, { onError: (error) => toast.error(getErrorMessage(error)) })}
            disabled={retry.isPending}
          >
            <RotateCw className="size-4" /> Try again
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export { TraineeVideoResponse };
