/** Reserved for group-related constant values that are NOT data — e.g. name/description length caps. */
export const MAX_GROUP_NAME_LENGTH = 150;
export const MAX_GROUP_DESCRIPTION_LENGTH = 1000;
export const MIN_GROUP_CAPACITY = 1;
export const MAX_GROUP_CAPACITY = 1000;

export const ACCEPTED_MEMBER_IMPORT_MIME_TYPES = ['text/csv', 'application/vnd.ms-excel'] as const;
export const MAX_MEMBER_IMPORT_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_MEMBER_IMPORT_ROWS = 1000;
