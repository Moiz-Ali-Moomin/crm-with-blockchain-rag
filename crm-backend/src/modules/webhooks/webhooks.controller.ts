/**
 * Webhooks Controller
 *
 * Thin controller — delegates all logic to WebhooksService.
 * All routes require authentication; admin/super_admin for write operations.
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UserRole } from '@prisma/client';
import {
  CreateWebhookSchema,
  UpdateWebhookSchema,
  WebhookQuerySchema,
  DeliveryQuerySchema,
  CreateWebhookDto,
  UpdateWebhookDto,
  WebhookQueryDto,
  DeliveryQueryDto,
} from './webhooks.dto';

@ApiTags('webhooks')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @Get()
  findAll(@Query(new ZodValidationPipe(WebhookQuerySchema)) query: WebhookQueryDto) {
    return this.service.findAll(query.page, query.limit);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  create(
    @Body(new ZodValidationPipe(CreateWebhookSchema)) dto: CreateWebhookDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.create(dto, user.tenantId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateWebhookSchema)) dto: UpdateWebhookDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post(':id/test')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  testWebhook(@Param('id') id: string) {
    return this.service.testWebhook(id);
  }

  @Get(':id/deliveries')
  getDeliveries(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(DeliveryQuerySchema)) query: DeliveryQueryDto,
  ) {
    return this.service.getDeliveries(id, query.page, query.limit);
  }

  @Post('deliveries/:deliveryId/retry')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  retryDelivery(@Param('deliveryId') deliveryId: string) {
    return this.service.retryDelivery(deliveryId);
  }
}
