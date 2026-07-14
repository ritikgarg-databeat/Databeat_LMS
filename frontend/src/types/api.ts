/** Mirrors the backend's response envelope — see ARCHITECTURE.md §11 (API Architecture). */
export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors: ApiFieldError[];
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}
