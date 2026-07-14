export const GROUPS_PAGE_SIZE = 10;
export const MEMBERS_PAGE_SIZE = 10;

export const STATUS_OPTIONS: { value: '' | 'ACTIVE' | 'ARCHIVED'; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
];
