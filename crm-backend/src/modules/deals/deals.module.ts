import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { DealsRepository } from './deals.repository';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { WalletsModule } from '../wallets/wallets.module';
import { QUEUE_NAMES } from '../../core/queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.AUTOMATION },
      { name: QUEUE_NAMES.NOTIFICATION },
      { name: QUEUE_NAMES.WEBHOOK_OUTBOUND },
      { name: QUEUE_NAMES.BLOCKCHAIN },
      { name: QUEUE_NAMES.PAYMENT_PROCESSING },
    ),
    BlockchainModule,
    WalletsModule,
  ],
  controllers: [DealsController],
  providers: [DealsService, DealsRepository],
  exports: [DealsService, DealsRepository],
})
export class DealsModule {}
