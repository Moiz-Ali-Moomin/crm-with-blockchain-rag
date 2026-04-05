/**
 * Automation Worker - Processes the 'automation-engine' queue
 * Calls AutomationService.processEvent() for each queued CRM event
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { AutomationService } from '../../modules/automation/automation.service';
import { AutomationTriggerPayload } from '../../modules/automation/engine/automation-event.types';
import { QUEUE_NAMES } from '../../core/queue/queue.constants';

@Processor(QUEUE_NAMES.AUTOMATION)
export class AutomationWorker extends WorkerHost {
  private readonly logger = new Logger(AutomationWorker.name);

  constructor(private readonly automationService: AutomationService) {
    super();
  }

  async process(job: Job<AutomationTriggerPayload>) {
    const { tenantId, event, entityId } = job.data;

    this.logger.debug(
      `Processing automation event: ${event} for entity ${entityId} (tenant: ${tenantId})`,
    );

    await this.automationService.processEvent({
      ...job.data,
      triggeredAt: job.data.triggeredAt ?? new Date().toISOString(),
    });

    return { processed: true };
  }
}
