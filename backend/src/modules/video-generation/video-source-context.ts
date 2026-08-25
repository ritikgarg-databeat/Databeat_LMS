import { createHash } from 'node:crypto';

import type { LessonResource, ResourceType } from '@prisma/client';

import { storageProvider } from '@/storage';
import {
  type DocumentTextSegment,
  EXTRACTABLE_DOCUMENT_MIME_TYPES,
  extractTextSegmentsFromResourceFile,
} from '@/utils/document-text-extractor';
import { logger } from '@/utils/logger';

import type { VideoGroundingSource, VideoSourceSnapshot } from './video-generation.types';

const SUPPORTED_TYPES = new Set<ResourceType>([
  'MARKDOWN',
  'CODE_SNIPPET',
  'PDF',
  'PRESENTATION',
  'DOCUMENT',
  'IMAGE',
]);
const MAX_SOURCE_CHARS = 60_000;
const SHORT_SOURCE_CHARS = 300;
const segmentCache = new Map<string, { version: string; segments: DocumentTextSegment[] }>();

interface VideoLessonRow {
  id: string;
  title: string;
  description: string | null;
  contentVersion: number;
  resources: LessonResource[];
}

export function listEligibleVideoSources(lesson: VideoLessonRow) {
  return lesson.resources
    .filter((resource) => SUPPORTED_TYPES.has(resource.type))
    .map((resource) => ({
      id: resource.id,
      sourceRef: `resource-${resource.id}`,
      title: resource.title,
      type: resource.type,
      filename: resource.originalFilename,
      supported: true,
    }));
}

export async function buildVideoSourceSnapshot(
  lesson: VideoLessonRow,
  requestedResourceIds?: string[],
): Promise<VideoSourceSnapshot> {
  const eligible = lesson.resources.filter((resource) => SUPPORTED_TYPES.has(resource.type));
  const selectedIdSet = new Set(requestedResourceIds ?? eligible.map((resource) => resource.id));
  const selected = eligible.filter((resource) => selectedIdSet.has(resource.id));

  if (requestedResourceIds?.some((id) => !eligible.some((resource) => resource.id === id))) {
    throw new Error('One or more selected resources are missing or unsupported.');
  }

  const sources: VideoGroundingSource[] = [];
  const warnings: string[] = [];
  sources.push({
    id: 'lesson-title',
    resourceId: null,
    label: 'Lesson title',
    type: 'LESSON_TITLE',
    content: lesson.title.trim(),
  });
  if (lesson.description?.trim()) {
    sources.push({
      id: 'lesson-description',
      resourceId: null,
      label: 'Lesson description',
      type: 'LESSON_DESCRIPTION',
      content: lesson.description.trim(),
    });
  }

  for (const resource of selected) {
    const resourceSources = await extractResourceSources(resource);
    if (resourceSources.length) sources.push(...resourceSources);
    else
      warnings.push(`${resource.title} contains no extractable text and can only be used as a visual asset.`);
  }

  let remaining = MAX_SOURCE_CHARS;
  const boundedSources = sources.flatMap((source) => {
    if (source.id === 'lesson-title') return [source];
    if (remaining <= 0) return [];
    const content = source.content.slice(0, remaining);
    remaining -= content.length;
    return content ? [{ ...source, content }] : [];
  });
  const evidenceChars = boundedSources.reduce(
    (total, source) => total + (source.isVisualOnly ? 0 : source.content.length),
    0,
  );
  if (evidenceChars < SHORT_SOURCE_CHARS) {
    warnings.push(
      'The selected lesson evidence is short; AI will build a lesson-centered explanation with clearly illustrative examples.',
    );
  }

  const selectedResourceIds = selected.map((resource) => resource.id).sort();
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        lessonId: lesson.id,
        title: lesson.title,
        description: lesson.description ?? '',
        contentVersion: lesson.contentVersion,
        resources: selected
          .map((resource) => ({
            id: resource.id,
            updatedAt: resource.updatedAt.toISOString(),
            type: resource.type,
            title: resource.title,
            fileSizeBytes: resource.fileSizeBytes,
            contentHash: createHash('sha256')
              .update(resource.content ?? '')
              .digest('hex'),
          }))
          .sort((left, right) => left.id.localeCompare(right.id)),
        evidenceHashes: boundedSources
          .filter((source) => source.id !== 'lesson-title')
          .map((source) => ({
            id: source.id,
            hash: createHash('sha256').update(source.content).digest('hex'),
          }))
          .sort((left, right) => left.id.localeCompare(right.id)),
      }),
    )
    .digest('hex');

  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    lessonDescription: lesson.description ?? undefined,
    contentVersion: lesson.contentVersion,
    fingerprint,
    selectedResourceIds,
    sources: boundedSources,
    warnings,
  };
}

async function extractResourceSources(resource: LessonResource): Promise<VideoGroundingSource[]> {
  if (resource.type === 'IMAGE' && resource.relativePath) {
    return [
      {
        id: `resource-${resource.id}`,
        resourceId: resource.id,
        label: `${resource.title} (IMAGE)`,
        type: resource.type,
        content: `Trainer-provided visual asset titled "${resource.title}". Use it only as a visual; do not infer facts from it.`,
        isVisualOnly: true,
      },
    ];
  }
  const content = resource.content?.trim() ?? '';
  if (
    !content &&
    resource.relativePath &&
    resource.mimeType &&
    EXTRACTABLE_DOCUMENT_MIME_TYPES.has(resource.mimeType)
  ) {
    try {
      const version = resource.updatedAt.toISOString();
      const cached = segmentCache.get(resource.id);
      let segments = cached?.version === version ? cached.segments : undefined;
      if (!segments) {
        const stream = await storageProvider.getReadStream({ relativePath: resource.relativePath });
        segments = await extractTextSegmentsFromResourceFile(stream, resource.mimeType);
        if (segmentCache.size >= 100) {
          const oldest = segmentCache.keys().next().value as string | undefined;
          if (oldest) segmentCache.delete(oldest);
        }
        segmentCache.set(resource.id, { version, segments });
      }
      return segments.map((segment) => ({
        id: `resource-${resource.id}#${segment.locator}`,
        resourceId: resource.id,
        label: `${resource.title} (${resource.type}, ${segment.locator.replace('-', ' ')})`,
        type: resource.type,
        content: segment.text,
      }));
    } catch (error) {
      logger.warn('Video source extraction failed', { resourceId: resource.id, error });
    }
  }
  if (!content) return [];
  return [
    {
      id: `resource-${resource.id}`,
      resourceId: resource.id,
      label: `${resource.title} (${resource.type})`,
      type: resource.type,
      content,
    },
  ];
}
