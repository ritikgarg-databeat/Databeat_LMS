export type DepartmentStatus = 'ACTIVE' | 'INACTIVE';

export type SortField = 'createdAt' | 'name';
export type SortOrder = 'asc' | 'desc';

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: DepartmentStatus;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    users: number;
    groups: number;
  };
}

export interface CreateDepartmentPayload {
  name: string;
  code: string;
  description?: string;
}

export interface UpdateDepartmentPayload {
  name?: string;
  code?: string;
  description?: string | null;
}

export interface UpdateDepartmentStatusPayload {
  status: DepartmentStatus;
}

export interface DepartmentListParams {
  page: number;
  pageSize: number;
  status?: DepartmentStatus;
  search?: string;
  sortBy?: SortField;
  sortOrder?: SortOrder;
}
