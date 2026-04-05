/**
 * Jobs Module - Registers all BullMQ workers
 * Workers are separate from the queue registration (in CoreModule/QueueModule)
 * because workers consume jobs while queues are used to produce jobs.
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailWorker } from './workers/email.worker';
import { NotificationWorker } from './workers/notification.worker';
import { AutomationWorker } from './workers/automation.worker';
import { WebhookWorker } from './workers/webhook.worker';
import { SmsWorker } from './workers/sms.worker';
import { AiEmbeddingWorker } from './workers/ai-embedding.worker';
import { BlockchainWorker } from './workers/blockchain.worker';
import { AutomationModule } from '../modules/automation/automation.module';
import { AiModule } from '../modules/ai/ai.module';
import { BlockchainModule } from '../modules/blockchain/blockchain.module';
import { QUEUE_NAMES } from '../core/queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.NOTIFICATION },
      { name: QUEUE_NAMES.AUTOMATION },
      { name: QUEUE_NAMES.WEBHOOK_OUTBOUND },
      { name: QUEUE_NAMES.SMS },
      { name: QUEUE_NAMES.AI_EMBEDDING },
      { name: QUEUE_NAMES.BLOCKCHAIN },
    ),
    AutomationModule,
    AiModule,
    BlockchainModule,
  ],
  providers: [
    EmailWorker,
    NotificationWorker,
    AutomationWorker,
    WebhookWorker,
    SmsWorker,
    AiEmbeddingWorker,
    BlockchainWorker,
  ],
})
export class JobsModule {}
