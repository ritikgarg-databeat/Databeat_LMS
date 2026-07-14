// Renders every resource attached to a lesson according to its `ResourceType`. A lesson can
// have zero, one, or many resources (e.g. a markdown writeup plus a PDF plus an external link,
// all on the same lesson) — every resource in the array is rendered, in `order`, not just the
// first. File-backed types whose bytes are served through the authenticated download endpoint
// (PDF/VIDEO/IMAGE) go through `useAuthenticatedMediaUrl` rather than a raw API URL — see that
// hook's doc-comment in `../hooks/use-authenticated-media-url.ts` for why a bare `src` attribute
// can't be pointed at the backend directly.
import { Download, ExternalLink as ExternalLinkIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

import { EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatFileSize } from '@/utils/file';

import { RESOURCE_TYPE_META } from '../constants';
import { useAuthenticatedMediaUrl, useDownloadResource } from '../hooks';
import type { LessonResource, ResourceType } from '../types';

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
}

function LessonContentRenderer({ lessonId, resources, lessonType, onVideoEnded }: LessonContentRendererProps) {
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
      {orderedResources.map((resource) => (
        <ResourceView
          key={resource.id}
          lessonId={lessonId}
          resource={resource}
          onVideoEnded={isSoleVideoLesson ? onVideoEnded : undefined}
        />
      ))}
    </div>
  );
}

function ResourceView({
  lessonId,
  resource,
  onVideoEnded,
}: {
  lessonId: string;
  resource: LessonResource;
  onVideoEnded?: () => void;
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
          <SyntaxHighlighter style={oneDark} showLineNumbers customStyle={{ margin: 0, borderRadius: '0.5rem' }}>
            {resource.content ?? ''}
          </SyntaxHighlighter>
        </TitledResource>
      );

    case 'EXTERNAL_LINK':
      return <ExternalLinkResource resource={resource} />;

    case 'PDF':
      return (
        <TitledResource resource={resource}>
          <PdfResource lessonId={lessonId} resource={resource} />
        </TitledResource>
      );

    case 'VIDEO':
      return (
        <TitledResource resource={resource}>
          <VideoResource lessonId={lessonId} resource={resource} onEnded={onVideoEnded} />
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
      return <DownloadableFileResource lessonId={lessonId} resource={resource} />;

    default:
      return null;
  }
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

function ExternalLinkResource({ resource }: { resource: LessonResource }) {
  return (
    <a
      href={resource.content ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
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
}: {
  lessonId: string;
  resource: LessonResource;
  onEnded?: () => void;
}) {
  const { url, isLoading, error } = useAuthenticatedMediaUrl(lessonId, resource.id);

  if (isLoading) return <Skeleton className="aspect-video w-full" />;
  if (error || !url) {
    return <p className="text-sm text-muted-foreground">Unable to load this video.</p>;
  }

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption -- uploaded lesson videos carry no caption tracks
    <video controls className="w-full rounded-md border bg-black" src={url} onEnded={onEnded} />
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

function DownloadableFileResource({ lessonId, resource }: { lessonId: string; resource: LessonResource }) {
  const download = useDownloadResource();

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
        onClick={() => void download(lessonId, resource.id, resource.originalFilename ?? resource.title)}
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
