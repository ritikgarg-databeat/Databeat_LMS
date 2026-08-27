// Renders every resource attached to a lesson according to its `ResourceType`. A lesson can
// have zero, one, or many resources (e.g. a markdown writeup plus a PDF plus an external link,
// all on the same lesson) — every resource in the array is rendered, in `order`, not just the
// first. File-backed types whose bytes are served through the authenticated download endpoint
// (PDF/VIDEO/IMAGE) go through `useAuthenticatedMediaUrl` rather than a raw API URL — see that
// hook's doc-comment in `../hooks/use-authenticated-media-url.ts` for why a bare `src` attribute
// can't be pointed at the backend directly.
import { Download, ExternalLink as ExternalLinkIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

import { EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatFileSize } from '@/utils/file';

import { RESOURCE_TYPE_META } from '../constants';
import { useAuthenticatedMediaUrl, useDownloadResource, useRecordResourceProgressMutation } from '../hooks';
import type { LessonResource, ResourceProgressResult, ResourceType } from '../types';

import { ResourceTypeIcon } from './resource-type-icon';

export interface LessonContentRendererProps {
  /** Needed alongside each resource's own id to resolve authenticated media/download URLs. */
  lessonId: string;
  resources: LessonResource[];
  /**
   * The lesson's own declared type (distinct from each individual resource's `type`) — used only
   * for the empty-state copy here.
   */
  lessonType: ResourceType;
  /**
   * Nice-to-have: fired when the lesson's ONLY resource is a VIDEO and playback reaches the end.
   * Callers may use this to auto-fire a "mark complete" mutation. The reliable, always-available
   * way to complete a lesson is a separate explicit "Mark as complete" affordance elsewhere on the
   * page — this callback intentionally isn't wired for lessons with zero/multiple resources or
   * non-video content, since "did the user actually finish" can't be inferred there.
   */
  onVideoEnded?: () => void;
  mandatory?: boolean;
  onResourceProgressChange?: (resourceId: string, completed: boolean) => void;
}

function LessonContentRenderer({
  lessonId,
  resources,
  lessonType,
  onVideoEnded,
  mandatory = false,
  onResourceProgressChange,
}: LessonContentRendererProps) {
  if (resources.length === 0) {
    return (
      <EmptyState
        title="No content has been added to this lesson yet"
        description={`This is set up as a ${RESOURCE_TYPE_META[lessonType].label.toLowerCase()} lesson — check back once the trainer has uploaded material.`}
      />
    );
  }

  const orderedResources = [...resources].sort((a, b) => a.order - b.order);
  const isSoleVideoLesson = orderedResources.length === 1 && orderedResources[0]?.type === 'VIDEO';

  return (
    <div className="space-y-8">
      {orderedResources.map((resource) => {
        const view = (
          <ResourceView
            lessonId={lessonId}
            resource={resource}
            mandatory={mandatory}
            onProgress={(completed) => onResourceProgressChange?.(resource.id, completed)}
            onVideoEnded={isSoleVideoLesson ? onVideoEnded : undefined}
          />
        );
        return mandatory ? (
          <MandatoryResourceTracker
            key={resource.id}
            lessonId={lessonId}
            resource={resource}
            onProgress={(completed) => onResourceProgressChange?.(resource.id, completed)}
          >
            {view}
          </MandatoryResourceTracker>
        ) : (
          <div key={resource.id}>{view}</div>
        );
      })}
    </div>
  );
}

function ResourceView({
  lessonId,
  resource,
  onVideoEnded,
  mandatory,
  onProgress,
}: {
  lessonId: string;
  resource: LessonResource;
  onVideoEnded?: () => void;
  mandatory: boolean;
  onProgress: (completed: boolean) => void;
}) {
  switch (resource.type) {
    case 'MARKDOWN':
      return (
        <TitledResource resource={resource}>
          <div className={MARKDOWN_CONTENT_CLASSNAME}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{resource.content ?? ''}</ReactMarkdown>
          </div>
        </TitledResource>
      );

    case 'CODE_SNIPPET':
      return (
        <TitledResource resource={resource}>
          <SyntaxHighlighter
            style={oneDark}
            showLineNumbers
            customStyle={{ margin: 0, borderRadius: '0.5rem' }}
          >
            {resource.content ?? ''}
          </SyntaxHighlighter>
        </TitledResource>
      );

    case 'EXTERNAL_LINK':
      return <ExternalLinkResource lessonId={lessonId} resource={resource} mandatory={mandatory} />;

    case 'PDF':
      return (
        <TitledResource resource={resource}>
          <PdfResource lessonId={lessonId} resource={resource} />
        </TitledResource>
      );

    case 'VIDEO':
      return (
        <TitledResource resource={resource}>
          <VideoResource
            lessonId={lessonId}
            resource={resource}
            mandatory={mandatory}
            onProgress={onProgress}
            onEnded={onVideoEnded}
          />
        </TitledResource>
      );

    case 'IMAGE':
      return (
        <TitledResource resource={resource}>
          <ImageResource lessonId={lessonId} resource={resource} />
        </TitledResource>
      );

    case 'PRESENTATION':
    case 'DOCUMENT':
    case 'ZIP':
      return <DownloadableFileResource lessonId={lessonId} resource={resource} mandatory={mandatory} />;

    default:
      return null;
  }
}

function requiredActiveSeconds(resource: LessonResource): number {
  if (resource.type === 'MARKDOWN' || resource.type === 'CODE_SNIPPET') {
    const words = (resource.content ?? '').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(10, Math.min(180, Math.ceil((words / 200) * 60)));
  }
  if (resource.type === 'IMAGE') return 5;
  if (resource.type === 'PDF' || resource.type === 'PRESENTATION' || resource.type === 'DOCUMENT') return 30;
  return 10;
}

function MandatoryResourceTracker({
  lessonId,
  resource,
  onProgress,
  children,
}: {
  lessonId: string;
  resource: LessonResource;
  onProgress: (completed: boolean) => void;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mutation = useRecordResourceProgressMutation();
  const initiallyCompleted =
    resource.progress?.status === 'COMPLETED' &&
    resource.progress.completedContentVersion === resource.contentVersion;
  const [progress, setProgress] = useState({
    completed: initiallyCompleted,
    activeSeconds: resource.progress?.activeTimeSeconds ?? 0,
    requiredSeconds: requiredActiveSeconds(resource),
    maxScroll: resource.progress?.maxScrollPercentage ?? 0,
  });
  const visibleRef = useRef(false);
  const openedRef = useRef(Boolean(resource.progress?.openedAt));

  const applyResult = useCallback(
    (result: ResourceProgressResult) => {
      const completed =
        result.status === 'COMPLETED' && result.completedContentVersion === resource.contentVersion;
      setProgress({
        completed,
        activeSeconds: result.activeTimeSeconds,
        requiredSeconds: result.requiredActiveSeconds,
        maxScroll: result.maxScrollPercentage,
      });
      onProgress(completed);
    },
    [onProgress, resource.contentVersion],
  );

  useEffect(() => {
    onProgress(initiallyCompleted);
  }, [initiallyCompleted, onProgress]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || progress.completed || resource.type === 'VIDEO') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.25);
        const requiresExplicitOpen = ['EXTERNAL_LINK', 'PRESENTATION', 'DOCUMENT', 'ZIP'].includes(
          resource.type,
        );
        if (visibleRef.current && !openedRef.current && !requiresExplicitOpen) {
          openedRef.current = true;
          mutation.mutate(
            { lessonId, resourceId: resource.id, payload: { event: 'OPEN' } },
            { onSuccess: applyResult },
          );
        }
      },
      { threshold: [0.25] },
    );
    observer.observe(element);
    const interval = window.setInterval(() => {
      if (!visibleRef.current || document.hidden) return;
      const rect = element.getBoundingClientRect();
      const visibleBottom = Math.min(window.innerHeight, Math.max(0, window.innerHeight - rect.top));
      const percentage = rect.height <= 0 ? 100 : Math.round(Math.min(1, visibleBottom / rect.height) * 100);
      mutation.mutate(
        {
          lessonId,
          resourceId: resource.id,
          payload: { event: 'VIEW', activeSecondsDelta: 5, scrollPercentage: percentage },
        },
        { onSuccess: applyResult },
      );
    }, 5_000);
    return () => {
      window.clearInterval(interval);
      observer.disconnect();
    };
  }, [applyResult, lessonId, mutation, progress.completed, resource.id, resource.type]);

  const canAcknowledge =
    resource.type !== 'VIDEO' &&
    progress.activeSeconds >= progress.requiredSeconds &&
    (!(resource.type === 'MARKDOWN' || resource.type === 'CODE_SNIPPET' || resource.type === 'IMAGE') ||
      progress.maxScroll >= 90);

  return (
    <div ref={containerRef} className="space-y-3 rounded-lg border border-border/70 p-4">
      {children}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
        <span className={progress.completed ? 'text-success' : 'text-muted-foreground'}>
          {progress.completed
            ? 'Resource completed'
            : resource.type === 'VIDEO'
              ? 'Watch the complete video without skipping.'
              : `Review time ${Math.min(progress.activeSeconds, progress.requiredSeconds)}/${progress.requiredSeconds}s`}
        </span>
        {resource.type !== 'VIDEO' && !progress.completed ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canAcknowledge || mutation.isPending}
            onClick={() =>
              mutation.mutate(
                { lessonId, resourceId: resource.id, payload: { event: 'ACKNOWLEDGE' } },
                { onSuccess: applyResult },
              )
            }
          >
            Mark resource reviewed
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function TitledResource({ resource, children }: { resource: LessonResource; children: React.ReactNode }) {
  return (
    <section aria-label={resource.title} className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ResourceTypeIcon type={resource.type} className="size-4 text-muted-foreground" />
        {resource.title}
      </h3>
      {children}
    </section>
  );
}

function ExternalLinkResource({
  lessonId,
  resource,
  mandatory,
}: {
  lessonId: string;
  resource: LessonResource;
  mandatory: boolean;
}) {
  const progress = useRecordResourceProgressMutation();
  return (
    <a
      href={resource.content ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        if (mandatory) progress.mutate({ lessonId, resourceId: resource.id, payload: { event: 'OPEN' } });
      }}
      className="flex items-center justify-between gap-3 rounded-md border p-4 transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <span className="flex items-center gap-3">
        <ResourceTypeIcon type={resource.type} className="size-6 text-muted-foreground" />
        <span className="text-sm font-medium">{resource.title}</span>
      </span>
      <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </a>
  );
}

function PdfResource({ lessonId, resource }: { lessonId: string; resource: LessonResource }) {
  const { url, isLoading, error } = useAuthenticatedMediaUrl(lessonId, resource.id);
  const download = useDownloadResource();

  if (isLoading) return <Skeleton className="h-[80vh] w-full" />;

  if (error || !url) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">Preview unavailable — download instead.</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void download(lessonId, resource.id, resource.originalFilename ?? resource.title)}
        >
          <Download /> Download
        </Button>
      </div>
    );
  }

  return <iframe src={url} className="h-[80vh] w-full rounded-md border" title={resource.title} />;
}

function VideoResource({
  lessonId,
  resource,
  onEnded,
  mandatory,
  onProgress,
}: {
  lessonId: string;
  resource: LessonResource;
  onEnded?: () => void;
  mandatory: boolean;
  onProgress: (completed: boolean) => void;
}) {
  const { url, isLoading, error } = useAuthenticatedMediaUrl(lessonId, resource.id);
  const mutation = useRecordResourceProgressMutation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const furthestRef = useRef(resource.progress?.furthestVideoSecond ?? 0);
  const lastReportedRef = useRef(resource.progress?.furthestVideoSecond ?? 0);

  if (isLoading) return <Skeleton className="aspect-video w-full" />;
  if (error || !url) {
    return <p className="text-sm text-muted-foreground">Unable to load this video.</p>;
  }

  const reportProgress = (force = false) => {
    const video = videoRef.current;
    if (!mandatory || !video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const current = video.currentTime;
    const from = Math.min(lastReportedRef.current, current);
    if (!force && current - lastReportedRef.current < 4) return;
    lastReportedRef.current = current;
    mutation.mutate(
      {
        lessonId,
        resourceId: resource.id,
        payload: {
          event: 'VIDEO_HEARTBEAT',
          activeSecondsDelta: Math.min(15, Math.max(0, current - from)),
          positionSeconds: current,
          durationSeconds: video.duration,
          watchedFromSeconds: from,
          watchedToSeconds: current,
        },
      },
      {
        onSuccess: (result) => {
          const completed =
            result.status === 'COMPLETED' && result.completedContentVersion === resource.contentVersion;
          furthestRef.current = Math.max(furthestRef.current, result.furthestVideoSecond);
          onProgress(completed);
          if (completed && force) onEnded?.();
        },
      },
    );
  };

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption -- uploaded lesson videos carry no caption tracks
    <video
      ref={videoRef}
      controls
      className="w-full rounded-md border bg-black"
      src={url}
      onTimeUpdate={(event) => {
        if (!mandatory) return;
        const video = event.currentTarget;
        if (video.currentTime <= furthestRef.current + 2)
          furthestRef.current = Math.max(furthestRef.current, video.currentTime);
        reportProgress();
      }}
      onSeeking={(event) => {
        if (mandatory && event.currentTarget.currentTime > furthestRef.current + 2) {
          event.currentTarget.currentTime = furthestRef.current;
        }
      }}
      onEnded={() => (mandatory ? reportProgress(true) : onEnded?.())}
    />
  );
}

function ImageResource({ lessonId, resource }: { lessonId: string; resource: LessonResource }) {
  const { url, isLoading, error } = useAuthenticatedMediaUrl(lessonId, resource.id);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error || !url) {
    return <p className="text-sm text-muted-foreground">Unable to load this image.</p>;
  }

  // `loading="lazy"` is safe here: this only mounts once the authenticated URL has resolved
  // (see the isLoading/error gates above), and it sits inside a scrollable lesson content list
  // where the image is frequently below the fold. No explicit width/height: these are
  // user-uploaded lesson images of arbitrary dimensions with no stored intrinsic size to read
  // ahead of time, so a fixed aspect-ratio box isn't available without an asset-pipeline change.
  return <img src={url} alt={resource.title} loading="lazy" className="max-w-full rounded-md" />;
}

function DownloadableFileResource({
  lessonId,
  resource,
  mandatory,
}: {
  lessonId: string;
  resource: LessonResource;
  mandatory: boolean;
}) {
  const download = useDownloadResource();
  const progress = useRecordResourceProgressMutation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
      <div className="flex items-center gap-3">
        <ResourceTypeIcon type={resource.type} className="size-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{resource.title}</p>
          <p className="text-xs text-muted-foreground">
            {resource.fileSizeBytes != null ? formatFileSize(resource.fileSizeBytes) : 'Unknown size'}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          if (mandatory) progress.mutate({ lessonId, resourceId: resource.id, payload: { event: 'OPEN' } });
          void download(lessonId, resource.id, resource.originalFilename ?? resource.title);
        }}
      >
        <Download /> Download
      </Button>
    </div>
  );
}

/**
 * Manual replacement for `@tailwindcss/typography`'s `prose` class (not installed in this
 * project) — arbitrary-variant selectors give markdown output reasonable heading/paragraph/list
 * spacing without pulling in a new dependency.
 */
const MARKDOWN_CONTENT_CLASSNAME =
  'max-w-none text-sm leading-relaxed text-foreground ' +
  '[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1:first-child]:mt-0 ' +
  '[&_h2]:mt-5 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2:first-child]:mt-0 ' +
  '[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3:first-child]:mt-0 ' +
  '[&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 ' +
  '[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 ' +
  '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground ' +
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs ' +
  '[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 ' +
  '[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse ' +
  '[&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:text-left ' +
  '[&_td]:border [&_td]:border-border [&_td]:p-2 ' +
  '[&_img]:max-w-full [&_img]:rounded-md [&_hr]:my-6 [&_hr]:border-border';

export { LessonContentRenderer };
