import type { GroupStatus } from '@prisma/client';

export interface GroupListFilters {
  status?: GroupStatus;
  departmentId?: string;
  experienceLevelId?: string;
  trainerId?: string;
  search?: string;
  startDateFrom?: string;
  startDateTo?: string;
}

export type GroupSortField = 'createdAt' | 'name' | 'startDate' | 'endDate';
export type SortOrder = 'asc' | 'desc';

export interface GroupStats {
  totalGroups: number;
  activeGroups: number;
  archivedGroups: number;
  totalDepartments: number;
  totalTrainees: number;
}
