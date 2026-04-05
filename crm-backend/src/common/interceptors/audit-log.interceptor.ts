/**
 * Audit Log Interceptor
 *
 * Records ALL mutating operations (POST/PUT/PATCH/DELETE) to the audit log.
 * Captures: who, what, when, before state, after state, IP address.
 *
 * Applied as a route-level interceptor (not globally) to avoid performance
 * overhead on read-heavy endpoints.
 *
 * Usage: @UseInterceptors(AuditLogInterceptor) on controllers or methods
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, body, headers, ip } = request;
    const user = (request as any).user;

    // Only audit mutating operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    if (!user?.tenantId) {
      return next.handle();
    }

    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: async (responseData: any) => {
          try {
            // Derive action from HTTP method + URL path
            const action = this.deriveAction(method, url);
            const { entityType, entityId } = this.extractEntityInfo(url, responseData);

            await this.prisma.withoutTenantScope(() =>
              this.prisma.auditLog.create({
                data: {
                  tenantId: user.tenantId,
                  userId: user.id,
                  action,
                  entityType,
                  entityId,
                  after: method !== 'DELETE' ? responseData?.data ?? responseData : undefined,
                  before: method === 'DELETE' ? responseData?.data ?? responseData : undefined,
                  ipAddress: ip ?? headers['x-forwarded-for'] as string,
                  userAgent: headers['user-agent'],
                  metadata: {
                    method,
                    path: url,
                    duration: Date.now() - startedAt,
                  },
                },
              }),
            );
          } catch {
            // Audit log failures must NOT affect the main operation
            // Silently fail; alerting should be done via external monitoring
          }
        },
      }),
    );
  }

  private deriveAction(method: string, url: string): string {
    const pathParts = url.split('/').filter(Boolean);
    const resource = pathParts[2] ?? 'unknown'; // api/v1/{resource}/...

    const methodActionMap: Record<string, string> = {
      POST: 'created',
      PUT: 'updated',
      PATCH: 'updated',
      DELETE: 'deleted',
    };

    return `${resource}.${methodActionMap[method] ?? 'mutated'}`;
  }

  private extractEntityInfo(url: string, responseData: any): {
    entityType?: string;
    entityId?: string;
  } {
    const pathParts = url.split('/').filter(Boolean);
    const resource = pathParts[2]; // api/v1/{resource}
    const entityId = pathParts[3] ?? responseData?.data?.id ?? responseData?.id;

    return {
      entityType: resource?.toUpperCase(),
      entityId,
    };
  }
}
