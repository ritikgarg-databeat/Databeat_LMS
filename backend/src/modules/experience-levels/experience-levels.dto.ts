export interface CreateExperienceLevelDto {
  name: string;
  code: string;
}

export interface UpdateExperienceLevelDto {
  name?: string;
  isActive?: boolean;
}
