import { APP_CONFIG } from '@/config/app.config';

export interface PaginationQuery {
  page?: string;
  pageSize?: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

/** Parses raw (string) query params into safe, bounded pagination values for a Prisma query. */
export function parsePaginationParams(query: PaginationQuery): PaginationParams {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(
    APP_CONFIG.MAX_PAGE_SIZE,
    Math.max(1, Number(query.pageSize) || APP_CONFIG.DEFAULT_PAGE_SIZE),
  );

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/** Builds the `meta` block returned alongside a paginated list response. */
export function buildPaginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return { page, pageSize, total };
}
