import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { ConditionEvaluator } from './engine/condition-evaluator';
import { ActionExecutor } from './engine/action-executor';
import { QUEUE_NAMES } from '../../core/queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.EMAIL },
      { name: QUEUE_NAMES.SMS },
      { name: QUEUE_NAMES.NOTIFICATION },
    ),
  ],
  controllers: [AutomationController],
  providers: [AutomationService, ConditionEvaluator, ActionExecutor],
  exports: [AutomationService],
})
export class AutomationModule {}
