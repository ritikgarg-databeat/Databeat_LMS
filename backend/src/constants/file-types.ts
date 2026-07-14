/** Allowed learning-material MIME types, per ARCHITECTURE.md §13/§17. Enforced by Multer's fileFilter. */
export const ACCEPTED_LESSON_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'video/mp4',
  'text/markdown',
  'application/zip',
] as const;

export const ACCEPTED_AVATAR_MIME_TYPES = ['image/png', 'image/jpeg'] as const;

export const MAX_LESSON_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB
export const MAX_AVATAR_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
