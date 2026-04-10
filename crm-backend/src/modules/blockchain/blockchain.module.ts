import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { BlockchainController } from './blockchain.controller';
import { BlockchainService } from './blockchain.service';
import { BlockchainRepository } from './blockchain.repository';
import { BlockchainListenerService } from './listener/blockchain-listener.service';
import { QUEUE_NAMES } from '../../core/queue/queue.constants';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.BLOCKCHAIN },
      { name: QUEUE_NAMES.BLOCKCHAIN_EVENTS },
    ),
  ],
  controllers: [BlockchainController],
  providers: [
    BlockchainService,
    BlockchainRepository,
    BlockchainListenerService, // Long-lived — starts on application bootstrap
  ],
  exports: [BlockchainService, BlockchainRepository, BlockchainListenerService, BullModule],
})
export class BlockchainModule {}
