/**
 * Integrations Controller
 *
 * Thin controller for third-party integration management.
 * Connect/disconnect/update require ADMIN or SUPER_ADMIN.
 */

import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import {
  ConnectIntegrationSchema,
  UpdateIntegrationSchema,
  ConnectIntegrationDto,
  UpdateIntegrationDto,
} from './integrations.dto';

@ApiTags('integrations')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('catalog')
  getCatalog() {
    return this.service.getAvailableIntegrations();
  }

  @Get(':type')
  findByType(@Param('type') type: string) {
    return this.service.findByType(type);
  }

  @Post(':type/connect')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  connect(
    @Param('type') type: string,
    @Body(new ZodValidationPipe(ConnectIntegrationSchema)) dto: ConnectIntegrationDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.connect(type, dto, user.tenantId);
  }

  @Post(':type/disconnect')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  disconnect(@Param('type') type: string, @CurrentUser() user: JwtUser) {
    return this.service.disconnect(type, user.tenantId);
  }

  @Put(':type')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updateSettings(
    @Param('type') type: string,
    @Body(new ZodValidationPipe(UpdateIntegrationSchema)) dto: UpdateIntegrationDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.updateSettings(type, dto, user.tenantId);
  }
}
