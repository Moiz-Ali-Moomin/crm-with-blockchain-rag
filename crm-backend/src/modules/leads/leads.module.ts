import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadsRepository } from './leads.repository';
import { ContactsRepository } from '../contacts/contacts.repository';
import { AnalyticsModule } from '../analytics/analytics.module';
import { QUEUE_NAMES } from '../../core/queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.AUTOMATION },
      { name: QUEUE_NAMES.NOTIFICATION },
      { name: QUEUE_NAMES.WEBHOOK_OUTBOUND },
    ),
    AnalyticsModule,
  ],
  controllers: [LeadsController],
  providers: [LeadsService, LeadsRepository, ContactsRepository],
  exports: [LeadsService, LeadsRepository],
})
export class LeadsModule {}
