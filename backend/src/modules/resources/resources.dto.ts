import type { ResourceType } from '@prisma/client';

// Request/response DTOs (API-facing shapes) for the resources module.

/**
 * Non-file body fields for `POST /resources/upload` (multipart/form-data, field name "file" —
 * see resources.controller.ts for how the file itself is read off `req.file`). `type` must be one
 * of the file-backed ResourceType values (resources.service.ts rejects the rest with a message
 * pointing the caller at `/resources/text`).
 */
export interface UploadResourceDto {
  title: string;
  type: ResourceType;
}

/** Body for `POST /resources/text` (JSON). `type` must be MARKDOWN, CODE_SNIPPET, or EXTERNAL_LINK. */
export interface CreateTextResourceDto {
  type: ResourceType;
  title: string;
  content: string;
}
