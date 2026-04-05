import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationsRepository } from './integrations.repository';

@Module({
  imports: [],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, IntegrationsRepository],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
