export interface GroupMemberListFilters {
  search?: string;
}

export type GroupMemberSortField = 'joinedAt' | 'name';
export type SortOrder = 'asc' | 'desc';

export interface BulkImportRowError {
  row: number;
  email: string;
  reason: string;
}

export interface BulkImportSummary {
  totalRows: number;
  added: number;
  skipped: number;
  errors: BulkImportRowError[];
}
