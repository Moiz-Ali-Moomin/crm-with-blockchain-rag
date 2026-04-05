/**
 * Pagination Utilities
 *
 * Pure functions for building paginated query parameters and results.
 * No NestJS or Prisma imports — can be used anywhere including tests.
 *
 * The Zod schema (PaginationSchema) stays in common/dto/pagination.dto.ts
 * because it depends on Zod and is tightly coupled to request parsing.
 * These helpers are the pure-computation layer that schemas call into.
 */

import { PaginatedResult } from '../types/api.types';

/**
 * Wraps raw query results into a paginated envelope.
 *
 * @example
 * const [rows, total] = await Promise.all([repo.findMany(...), repo.count(...)]);
 * return buildPaginatedResult(rows, total, page, limit);
 */
export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Converts page/limit into Prisma's skip/take arguments.
 *
 * @example
 * prisma.lead.findMany({ ...buildPrismaSkipTake(page, limit) })
 */
export function buildPrismaSkipTake(
  page: number,
  limit: number,
): { skip: number; take: number } {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * Calculates the total number of pages.
 */
export function totalPages(total: number, limit: number): number {
  return Math.ceil(total / limit);
}

/**
 * Returns true if there is a next page.
 */
export function hasNextPage(page: number, total: number, limit: number): boolean {
  return page * limit < total;
}
