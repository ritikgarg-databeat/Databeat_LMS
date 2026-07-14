export type GroupStatus = 'ACTIVE' | 'ARCHIVED';
export type SortField = 'createdAt' | 'name' | 'startDate' | 'endDate';
export type SortOrder = 'asc' | 'desc';
export type MemberSortField = 'joinedAt' | 'name';

/** Minimal shape for populating the department dropdown — feature-local, see README note. */
export interface DepartmentOption {
  id: string;
  name: string;
}

/** Minimal shape for populating the experience level dropdown — feature-local, see README note. */
export interface ExperienceLevelOption {
  id: string;
  name: string;
  code: string;
}

/** Minimal shape for populating the trainer-assignment dropdown — feature-local, see README note. */
export interface TrainerOption {
  id: string;
  fullName: string;
  email: string;
}

/** Minimal shape for `GET /groups/mine` — populates a "pick one of my own groups" dropdown. */
export interface MyGroupOption {
  id: string;
  name: string;
  code: string;
}

export interface GroupDepartmentSummary {
  id: string;
  name: string;
  code: string;
}

export interface GroupExperienceLevelSummary {
  id: string;
  name: string;
  code: string;
}

export interface GroupTrainerSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Group {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  department: GroupDepartmentSummary;
  experienceLevelId: string | null;
  experienceLevel: GroupExperienceLevelSummary | null;
  trainerId: string | null;
  trainer: GroupTrainerSummary | null;
  description: string | null;
  status: GroupStatus;
  startDate: string | null;
  endDate: string | null;
  capacity: number | null;
  createdById: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    members: number;
  };
}

export interface GroupListFilters {
  status?: GroupStatus;
  departmentId?: string;
  experienceLevelId?: string;
  trainerId?: string;
  search?: string;
  startDateFrom?: string;
  startDateTo?: string;
}

export interface GroupListParams extends GroupListFilters {
  page: number;
  pageSize: number;
  sortBy?: SortField;
  sortOrder?: SortOrder;
}

export interface CreateGroupPayload {
  name: string;
  code: string;
  departmentId: string;
  experienceLevelId?: string;
  trainerId?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  capacity?: number;
}

/** `trainerId` is deliberately absent — trainer reassignment goes through `PATCH /:id/trainer`. */
export interface UpdateGroupPayload {
  name?: string;
  code?: string;
  departmentId?: string;
  experienceLevelId?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  capacity?: number | null;
}

export interface UpdateGroupStatusPayload {
  status: GroupStatus;
}

export interface AssignTrainerPayload {
  trainerId: string | null;
}

export interface DuplicateGroupPayload {
  name: string;
  code: string;
}

export interface GroupStats {
  totalGroups: number;
  activeGroups: number;
  archivedGroups: number;
  totalDepartments: number;
  totalTrainees: number;
  recentGroups: Group[];
}

export interface GroupMemberUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  departmentId: string | null;
  experienceLevelId: string | null;
  lastLogin: string | null;
}

export interface GroupMember {
  id: string;
  userId: string;
  groupId: string;
  addedById: string | null;
  joinedAt: string;
  user: GroupMemberUser;
}

export interface GroupMemberListFilters {
  search?: string;
}

export interface GroupMemberListParams extends GroupMemberListFilters {
  page: number;
  pageSize: number;
  sortBy?: MemberSortField;
  sortOrder?: SortOrder;
}

export interface AddGroupMemberPayload {
  userId: string;
}

export interface AddGroupMembersPayload {
  userIds: string[];
}

export interface AddGroupMembersResult {
  added: number;
  skipped: number;
}

export interface TransferGroupMemberPayload {
  toGroupId: string;
}

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

/** Minimal shape used by the "assign existing trainees" checklist — see add-member-dialog.tsx. */
export interface TraineeOption {
  id: string;
  fullName: string;
  email: string;
}
