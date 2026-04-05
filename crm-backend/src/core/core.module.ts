/**
 * Core Module - @Global()
 *
 * Exports infrastructure singletons available to ALL modules:
 * - PrismaService (DB client with tenant middleware)
 * - RedisService (ioredis wrapper)
 * - WsService (WebSocket emitter)
 * - LoggerService
 *
 * Being @Global() means modules don't need to import CoreModule explicitly.
 */

import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PrismaService } from './database/prisma.service';
import { PrismaTransactionService } from './database/prisma-transaction.service';
import { RedisService } from './cache/redis.service';
import { QueueModule } from './queue/queue.module';
import { WsGateway } from './websocket/ws.gateway';
import { WsService } from './websocket/ws.service';
import { AuditLogInterceptor } from '../common/interceptors/audit-log.interceptor';
import { MongoModule } from './database/mongo.module';
import { EventLog, EventLogSchema } from './database/schemas/event-log.schema';
import { EventLogRepository } from './database/repositories/event-log.repository';

@Global()
@Module({
  imports: [
    QueueModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
    // Establishes the MongoDB connection (global, shared across all modules)
    MongoModule,
    // Register the EventLog collection — available globally via EventLogRepository
    MongooseModule.forFeature([{ name: EventLog.name, schema: EventLogSchema }]),
  ],
  providers: [
    PrismaService,
    PrismaTransactionService,
    RedisService,
    WsGateway,
    WsService,
    AuditLogInterceptor,
    EventLogRepository,
  ],
  exports: [
    PrismaService,
    PrismaTransactionService,
    RedisService,
    QueueModule,
    WsGateway,
    WsService,
    AuditLogInterceptor,
    // EventLogRepository exported globally — automation, webhook, activity modules
    // can inject it directly without importing CoreModule (it's @Global())
    EventLogRepository,
  ],
})
export class CoreModule {}
