/**
 * API Response Types
 *
 * Canonical shapes for all HTTP responses in the application.
 * Consumed by:
 *  - ResponseTransformInterceptor (wraps successful responses)
 *  - AllExceptionsFilter (builds error responses)
 *  - Frontend API client (TypeScript types for fetch calls)
 *
 * No NestJS imports — pure TypeScript.
 */

/** Shape of every successful API response */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  message?: string;
  timestamp: string;
  requestId?: string;
}

/** Shape of every error API response */
export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  errors?: Record<string, string[]>;
  requestId?: string;
  timestamp: string;
  path: string;
}

/** Pagination metadata attached to list responses */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Paginated data wrapper returned by repositories and services */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  message?: string;
}
