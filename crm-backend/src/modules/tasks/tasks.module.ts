import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TasksRepository } from './tasks.repository';
import { QUEUE_NAMES } from '../../core/queue/queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATION })],
  controllers: [TasksController],
  providers: [TasksService, TasksRepository],
  exports: [TasksService],
})
export class TasksModule {}
