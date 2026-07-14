export interface AddGroupMemberDto {
  userId: string;
}

export interface AddGroupMembersDto {
  userIds: string[];
}

export interface TransferGroupMemberDto {
  toGroupId: string;
}

export interface ListGroupMembersQueryDto {
  page?: string;
  pageSize?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}
