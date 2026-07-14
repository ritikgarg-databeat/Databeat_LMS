import type { PaginationMeta } from '@/utils/pagination.util';

export type ID = string;

export type Nullable<T> = T | null;

export interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}
