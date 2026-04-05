/**
 * Root Application Module
 *
 * Architecture decisions:
 * - CoreModule is @Global() — provides Prisma, Redis, Logger everywhere
 * - ThrottlerModule uses Redis storage for distributed rate limiting
 * - Each feature module is self-contained (owns its controller/service/repo)
 */

import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

import { validateEnv } from './config/env.validation';
import { CoreModule } from './core/core.module';

// Feature modules
import { TenantModule } from './modules/tenant/tenant.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { LeadsModule } from './modules/leads/leads.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { DealsModule } from './modules/deals/deals.module';
import { PipelinesModule } from './modules/pipelines/pipelines.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { EmailTemplatesModule } from './modules/email-templates/email-templates.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { AutomationModule } from './modules/automation/automation.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { BillingModule } from './modules/billing/billing.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AiModule } from './modules/ai/ai.module';
import { BlockchainModule } from './modules/blockchain/blockchain.module';
import { JobsModule } from './jobs/jobs.module';
import { HealthModule } from './health/health.module';

// Middleware
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';

@Module({
  imports: [
    // ── Configuration ────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
      validate: validateEnv,
      cache: true,
    }),

    // ── Logger ───────────────────────────────────────────────────────────────
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
              const ctx = context ? `[${context}]` : '';
              const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
              return `${timestamp} ${level} ${ctx} ${message}${metaStr}`;
            }),
          ),
        }),
        // In production, add file transport or ship to external logging service
        ...(process.env.NODE_ENV === 'production'
          ? [
              new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
              new winston.transports.File({ filename: 'logs/combined.log' }),
            ]
          : []),
      ],
    }),

    // ── Rate Limiting (Redis-backed for distributed deployments) ─────────────
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,       // 1 second
        limit: 20,       // 20 req/sec per IP
      },
      {
        name: 'medium',
        ttl: 60000,      // 1 minute
        limit: 200,      // 200 req/min per IP
      },
      {
        name: 'long',
        ttl: 3600000,    // 1 hour
        limit: 1000,     // 1000 req/hr per IP
      },
    ]),

    // ── Core Infrastructure ──────────────────────────────────────────────────
    CoreModule,

    // ── Feature Modules ──────────────────────────────────────────────────────
    TenantModule,
    AuthModule,
    UsersModule,
    RbacModule,
    LeadsModule,
    ContactsModule,
    CompaniesModule,
    DealsModule,
    PipelinesModule,
    ActivitiesModule,
    TasksModule,
    CommunicationsModule,
    EmailTemplatesModule,
    TicketsModule,
    AutomationModule,
    NotificationsModule,
    WebhooksModule,
    IntegrationsModule,
    BillingModule,
    AnalyticsModule,
    AiModule,
    BlockchainModule,

    // ── Background Jobs ──────────────────────────────────────────────────────
    JobsModule,

    // ── Health Checks ────────────────────────────────────────────────────────
    HealthModule,
  ],
  providers: [
    // Apply JwtAuthGuard globally — all routes protected unless @Public() is set
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Apply rate limiting globally — configured in ThrottlerModule above
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Inject X-Request-ID on every request for distributed tracing
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    // Extract tenantId from JWT, store in AsyncLocalStorage
    // Applied AFTER auth routes to avoid circular dependency
    consumer
      .apply(TenantContextMiddleware)
      .exclude(
        { path: 'api/v1/auth/(.*)', method: RequestMethod.ALL },
        { path: 'api/v1/health', method: RequestMethod.GET },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
