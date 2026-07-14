// Experience level options are no longer a fixed set — they're fetched dynamically via
// useExperienceLevelsQuery() (backend now stores them in a lookup table specifically so
// new levels can be added without a code change; see ARCHITECTURE.md / Prompt 4).

export const STATUS_OPTIONS: { value: 'true' | 'false'; label: string }[] = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Disabled' },
];

export const USERS_PAGE_SIZE = 10;
