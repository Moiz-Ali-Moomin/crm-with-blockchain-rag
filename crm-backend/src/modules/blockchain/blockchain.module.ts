import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';
import { BlockchainRepository } from './blockchain.repository';
import { QUEUE_NAMES } from '../../core/queue/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.BLOCKCHAIN }),
  ],
  controllers: [BlockchainController],
  providers: [BlockchainService, BlockchainRepository],
  exports: [BlockchainService, BlockchainRepository, BullModule],
})
export class BlockchainModule {}
