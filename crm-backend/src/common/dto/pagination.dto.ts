/**
 * Pagination DTO - Used across all list endpoints
 * Validates and normalizes page/limit/sort/search query parameters.
 *
 * Pure computation helpers live in shared/utils/pagination.utils.ts.
 * This file owns the Zod schema (request-parsing concern) and re-exports
 * the helpers so existing imports keep working without change.
 */

import { z } from 'zod';

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});

export type PaginationDto = z.infer<typeof PaginationSchema>;

// Re-export shared types and helpers so all existing `import ... from '.../pagination.dto'`
// statements continue to work without modification.
export type { PaginatedResult } from '../../shared/types/api.types';
export {
  buildPaginatedResult,
  buildPrismaSkipTake,
} from '../../shared/utils/pagination.utils';
