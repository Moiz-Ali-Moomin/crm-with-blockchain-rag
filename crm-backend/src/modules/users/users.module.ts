import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { QUEUE_NAMES } from '../../core/queue/queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.EMAIL })],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
