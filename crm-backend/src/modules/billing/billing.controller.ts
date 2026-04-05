/**
 * Billing Controller
 *
 * Thin controller for billing and subscription management.
 * The webhook route is @Public() and uses rawBody from the request.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Headers,
  Req,
  RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { CreateCheckoutSessionSchema, CreateCheckoutSessionDto } from './billing.dto';

@ApiTags('billing')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getBillingInfo(@CurrentUser() user: JwtUser) {
    return this.service.getBillingInfo(user.tenantId);
  }

  @Get('plans')
  getPlans() {
    return this.service.getPlans();
  }

  @Post('checkout')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  createCheckoutSession(
    @CurrentUser() user: JwtUser,
    @Body(new ZodValidationPipe(CreateCheckoutSessionSchema)) dto: CreateCheckoutSessionDto,
  ) {
    return this.service.createCheckoutSession(user.tenantId, dto);
  }

  @Post('cancel')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  cancelSubscription(@CurrentUser() user: JwtUser) {
    return this.service.cancelSubscription(user.tenantId);
  }

  @Get('invoices')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getInvoices(@CurrentUser() user: JwtUser) {
    return this.service.getInvoices(user.tenantId);
  }

  @Post('webhook')
  @Public()
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    return this.service.handleWebhook(req.rawBody, signature);
  }
}
