import { Module } from '@nestjs/common';
import { PipelinesController } from './pipelines.controller';
import { PipelinesService } from './pipelines.service';
import { PipelinesRepository } from './pipelines.repository';
import { PrismaTransactionService } from '../../core/database/prisma-transaction.service';

@Module({
  imports: [],
  controllers: [PipelinesController],
  providers: [PipelinesService, PipelinesRepository, PrismaTransactionService],
  exports: [PipelinesService],
})
export class PipelinesModule {}
