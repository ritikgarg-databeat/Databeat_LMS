/** Allowed learning-material file types, per ARCHITECTURE.md §13 (File Storage Architecture). */
export const ACCEPTED_LESSON_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'video/mp4': ['.mp4'],
  'text/markdown': ['.md'],
  'application/zip': ['.zip'],
} as const;

export const ACCEPTED_AVATAR_FILE_TYPES = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
} as const;

export const MAX_LESSON_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB
export const MAX_AVATAR_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
