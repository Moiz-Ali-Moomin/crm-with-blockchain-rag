import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { ActivitiesRepository } from './activities.repository';
import { QUEUE_NAMES } from '../../core/queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.AI_EMBEDDING }),
  ],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, ActivitiesRepository],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
