// Constant values specific to the classroom feature.
import type { CourseDifficulty, CourseStatus, ResourceType } from '../types';

export const COURSES_PAGE_SIZE = 10;

/** Mirrors the backend's default for `GET /progress/continue-learning` (max 20). */
export const CONTINUE_LEARNING_DEFAULT_LIMIT = 5;

export const STATUS_OPTIONS: { value: '' | CourseStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export const DIFFICULTY_OPTIONS: { value: '' | CourseDifficulty; label: string }[] = [
  { value: '', label: 'All difficulties' },
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
];

export interface ResourceTypeMeta {
  label: string;
  /** File-backed types are created via the upload endpoint; the rest via the text endpoint. */
  isFileBacked: boolean;
}

/**
 * Lookup other engineers use to decide upload-vs-text-resource UI branching and to label
 * resource type badges. Icon mapping deliberately lives separately in
 * `components/resource-type-icon.tsx` so this file stays free of UI-library imports.
 */
export const RESOURCE_TYPE_META: Record<ResourceType, ResourceTypeMeta> = {
  MARKDOWN: { label: 'Markdown', isFileBacked: false },
  PDF: { label: 'PDF', isFileBacked: true },
  VIDEO: { label: 'Video', isFileBacked: true },
  IMAGE: { label: 'Image', isFileBacked: true },
  PRESENTATION: { label: 'Presentation', isFileBacked: true },
  DOCUMENT: { label: 'Document', isFileBacked: true },
  ZIP: { label: 'ZIP Archive', isFileBacked: true },
  EXTERNAL_LINK: { label: 'External Link', isFileBacked: false },
  CODE_SNIPPET: { label: 'Code Snippet', isFileBacked: false },
};
