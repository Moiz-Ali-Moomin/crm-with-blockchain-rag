/**
 * MongoModule — Global secondary database connection
 *
 * Responsibilities:
 * - Establishes a single Mongoose connection shared across all modules
 * - Reads MONGO_URI from ConfigService (validated at startup)
 * - @Global() so MongooseModule.forRoot() connection is available everywhere
 *   without re-importing this module in every feature module
 *
 * Usage:
 * - This module is imported ONCE in CoreModule
 * - Feature modules register their own schemas via:
 *     MongooseModule.forFeature([{ name: MyDoc.name, schema: MyDocSchema }])
 *
 * Multi-tenancy note:
 * - MongoDB does NOT use the AsyncLocalStorage tenant middleware
 * - Every repository method MUST receive tenantId explicitly and include
 *   it in every query/insert — enforced by TypeScript via MongoDocument base type
 */

import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.getOrThrow<string>('MONGO_URI');
        return {
          uri,
          // Connection pool — matches Prisma's default pool size
          maxPoolSize: 10,
          minPoolSize: 2,
          // Timeout settings aligned with NestJS lifecycle
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 10000,
          socketTimeoutMS: 45000,
          // Automatically retry writes once on transient network errors
          retryWrites: true,
          // Use new URL string parser (required in Mongoose 7+)
          // App name shows up in MongoDB Atlas monitoring
          appName: 'crm-saas',
        };
      },
    }),
  ],
  // MongooseModule connection is available globally — no exports needed here.
  // Each feature module calls MongooseModule.forFeature([...]) independently.
})
export class MongoModule {}
