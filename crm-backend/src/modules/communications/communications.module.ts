import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { CommunicationsRepository } from './communications.repository';
import { QUEUE_NAMES } from '../../core/queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.SMS },
      { name: QUEUE_NAMES.AI_EMBEDDING },
    ),
  ],
  controllers: [CommunicationsController],
  providers: [CommunicationsService, CommunicationsRepository],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
