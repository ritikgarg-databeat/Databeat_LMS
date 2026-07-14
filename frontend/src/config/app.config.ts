/** App-wide, non-secret configuration values that aren't environment-specific. */
export const APP_CONFIG = {
  APP_NAME: 'Databeat LMS',
  DEFAULT_PAGE_SIZE: 20,
  REQUEST_TIMEOUT_MS: 15_000,
} as const;
