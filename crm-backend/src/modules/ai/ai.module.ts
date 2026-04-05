import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { EmbeddingService } from './embedding.service';
import { VectorSearchService } from './vector-search.service';
import { CopilotService } from './copilot.service';
import { RagService } from './rag.service';
import { AiLog, AiLogSchema } from './schemas/ai-log.schema';
import { AiLogRepository } from './repositories/ai-log.repository';
import { QUEUE_NAMES } from '../../core/queue/queue.constants';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    // Register the AI embedding queue so other services can @InjectQueue it
    BullModule.registerQueue({ name: QUEUE_NAMES.AI_EMBEDDING }),
    // Register the AiLog Mongoose model for this module
    // MongooseModule.forRoot() connection is already established globally via CoreModule → MongoModule
    MongooseModule.forFeature([{ name: AiLog.name, schema: AiLogSchema }]),
    // Import BlockchainModule so AiService can inject BlockchainService
    // for the combined RAG + blockchain deal verification use case
    BlockchainModule,
  ],
  controllers: [AiController],
  providers: [AiService, EmbeddingService, VectorSearchService, CopilotService, RagService, AiLogRepository],
  exports: [EmbeddingService, RagService, BullModule, AiLogRepository],
})
export class AiModule {}

