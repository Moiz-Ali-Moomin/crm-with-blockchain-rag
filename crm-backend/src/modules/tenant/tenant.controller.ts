/**
 * Tenant Controller
 *
 * Manages tenant profile, settings, and statistics.
 * GET /tenant/current is accessible to all authenticated users.
 * Mutation routes require ADMIN or SUPER_ADMIN.
 */

import { Controller, Get, Put, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import {
  UpdateTenantSchema,
  UpdateTenantSettingsSchema,
  UpdateTenantDto,
  UpdateTenantSettingsDto,
} from './tenant.dto';

@ApiTags('tenant')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenant')
export class TenantController {
  constructor(private readonly service: TenantService) {}

  @Get('current')
  getCurrent(@CurrentUser() user: JwtUser) {
    return this.service.getCurrent(user.tenantId);
  }

  @Put('current')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  update(
    @CurrentUser() user: JwtUser,
    @Body(new ZodValidationPipe(UpdateTenantSchema)) dto: UpdateTenantDto,
  ) {
    return this.service.update(user.tenantId, dto);
  }

  @Patch('current/settings')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateSettings(
    @CurrentUser() user: JwtUser,
    @Body(new ZodValidationPipe(UpdateTenantSettingsSchema)) dto: UpdateTenantSettingsDto,
  ) {
    return this.service.updateSettings(user.tenantId, dto);
  }

  @Get('current/stats')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getStats(@CurrentUser() user: JwtUser) {
    return this.service.getStats(user.tenantId);
  }
}
