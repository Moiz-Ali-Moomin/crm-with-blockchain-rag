/**
 * Response Transform Interceptor
 * Wraps all successful responses in a consistent envelope:
 * { success: true, data: T, meta?: PaginationMeta, timestamp: string }
 *
 * This ensures the frontend always knows the shape of a successful response.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import type { ApiResponse } from '../../shared/types/api.types';

export type { ApiResponse };

@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = request.headers['x-request-id'] as string;

    return next.handle().pipe(
      map((data) => {
        // If the handler already returns an ApiResponse shape, don't double-wrap
        if (data && typeof data === 'object' && 'success' in data) {
          return { ...data, timestamp: new Date().toISOString(), requestId };
        }

        // Extract pagination metadata if the response includes it
        if (data && typeof data === 'object' && 'data' in data && 'total' in data) {
          const { data: items, total, page, limit, totalPages, message, ...rest } = data as any;
          return {
            success: true,
            data: items,
            meta: { total, page, limit, totalPages, ...rest },
            message,
            timestamp: new Date().toISOString(),
            requestId,
          };
        }

        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
          requestId,
        };
      }),
    );
  }
}
