/** Generic lifecycle statuses reused across future models (Progress, Course, Attempt, etc). */
export const PROGRESS_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;
export type ProgressStatus = (typeof PROGRESS_STATUS)[keyof typeof PROGRESS_STATUS];

export const PUBLISH_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type PublishStatus = (typeof PUBLISH_STATUS)[keyof typeof PUBLISH_STATUS];

export const ACCOUNT_STATUS = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
} as const;
export type AccountStatus = (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];
