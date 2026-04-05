import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { TenantRepository } from './tenant.repository';

@Module({
  imports: [],
  controllers: [TenantController],
  providers: [TenantService, TenantRepository],
  exports: [TenantService],
})
export class TenantModule {}
