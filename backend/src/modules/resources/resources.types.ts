import { ResourceType } from '@prisma/client';

// Internal domain types for the resources module.

/**
 * Resource types created via the multipart `POST /resources/upload` endpoint — file-backed,
 * populate relativePath/originalFilename/mimeType/fileSizeBytes and leave `content` null
 * (Prompt 5 § LESSON RESOURCE TYPES).
 */
export const FILE_BACKED_RESOURCE_TYPES = [
  ResourceType.PDF,
  ResourceType.VIDEO,
  ResourceType.IMAGE,
  ResourceType.PRESENTATION,
  ResourceType.DOCUMENT,
  ResourceType.ZIP,
] as const;

export type FileBackedResourceType = (typeof FILE_BACKED_RESOURCE_TYPES)[number];

/**
 * Resource types created via the JSON `POST /resources/text` endpoint — text-backed, populate
 * `content` (raw markdown/code, or a URL for EXTERNAL_LINK) and leave the file fields null.
 */
export const TEXT_BACKED_RESOURCE_TYPES = [
  ResourceType.MARKDOWN,
  ResourceType.CODE_SNIPPET,
  ResourceType.EXTERNAL_LINK,
] as const;

export type TextBackedResourceType = (typeof TEXT_BACKED_RESOURCE_TYPES)[number];
