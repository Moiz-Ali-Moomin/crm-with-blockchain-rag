/**
 * Prisma Service with Tenant Isolation via Client Extensions
 *
 * CRITICAL: This extension automatically injects tenantId into every
 * query, preventing accidental cross-tenant data access.
 * The tenantId is read from AsyncLocalStorage (set by TenantContextMiddleware).
 *
 * Uses Prisma Client Extensions ($extends) — replaces deprecated $use middleware.
 *
 * Models excluded from tenant scoping:
 * - Tenant (the root entity itself)
 * - BillingInfo
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { tenantContext } from '../../common/middleware/tenant-context.middleware';

// Models that must never have automatic tenant scoping injected
const UNSCOPED_MODELS = new Set(['Tenant', 'BillingInfo']);

// findUnique is intentionally excluded: injecting tenantId into findUnique's where
// clause breaks Prisma because {id, tenantId} is not a composite unique constraint.
// All findUnique callers in this codebase already use withoutTenantScope() explicitly.
// Use findFirst with a tenantId filter instead of findUnique in tenant-scoped code.
const READ_OPS  = new Set(['findMany', 'findFirst', 'count', 'aggregate', 'groupBy']);
const WRITE_OPS = new Set(['update', 'delete', 'updateMany', 'deleteMany']);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    });

    // Log slow queries in development
    if (process.env.NODE_ENV === 'development') {
      (this as any).$on('query', (e: Prisma.QueryEvent) => {
        if (e.duration > 100) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query.substring(0, 200)}`);
        }
      });
    }

    // Tenant isolation via Prisma Client Extensions ($extends replaces deprecated $use)
    // Runs before EVERY model operation — keep logic O(1), no I/O.
    const extended = (this as any).$extends({
      query: {
        $allModels: {
          $allOperations({ model, operation, args, query }: {
            model: string;
            operation: string;
            args: Record<string, any>;
            query: (args: Record<string, any>) => Promise<unknown>;
          }) {
            const tenantId = tenantContext.getStore()?.tenantId;

            // Bypass: no HTTP context (workers), public routes, or unscoped models
            if (!tenantId || UNSCOPED_MODELS.has(model ?? '')) {
              return query(args);
            }

            if (READ_OPS.has(operation)) {
              args = { ...args, where: { ...args.where, tenantId } };
            } else if (operation === 'create') {
              args = { ...args, data: { ...args.data, tenantId } };
            } else if (operation === 'createMany') {
              args = { ...args, data: (args.data as Record<string, unknown>[]).map((item) => ({ ...item, tenantId })) };
            } else if (WRITE_OPS.has(operation)) {
              // Scopes UPDATE/DELETE to owning tenant — prevents cross-tenant mutations
              args = { ...args, where: { ...args.where, tenantId } };
            }

            return query(args);
          },
        },
      },
    });

    // Copy extended model delegates onto this instance.
    // Class methods (onModuleInit, withoutTenantScope, etc.) remain on the prototype.
    return Object.assign(this, extended) as this;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }

  /**
   * Execute a query without tenant scoping.
   * USE WITH EXTREME CAUTION - only for super-admin operations.
   */
  async withoutTenantScope<T>(fn: () => Promise<T>): Promise<T> {
    return tenantContext.run({ tenantId: null as any, bypassScope: true }, fn);
  }
}
