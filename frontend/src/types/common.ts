export type ID = string;

export type Nullable<T> = T | null;

/** Standard shape for paginated list query params sent to the API. */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}
