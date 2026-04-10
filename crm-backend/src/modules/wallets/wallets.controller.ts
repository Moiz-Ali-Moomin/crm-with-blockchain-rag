import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WalletsService } from './wallets.service';
import { ProvisionWalletDto } from './wallets.dto';

@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  /** GET /wallets — list all wallets for this tenant */
  @Get()
  listWallets(@Request() req: any) {
    return this.walletsService.findByTenant(req.user.tenantId);
  }

  /** GET /wallets/:id — get wallet by id */
  @Get(':id')
  getWallet(@Param('id') id: string, @Request() req: any) {
    return this.walletsService.findById(id, req.user.tenantId);
  }

  /** GET /wallets/:id/balance — sync + return USDC balance */
  @Get(':id/balance')
  getBalance(@Param('id') id: string, @Request() req: any) {
    return this.walletsService.syncBalance(id, req.user.tenantId);
  }

  /** POST /wallets/provision — provision a new tenant wallet */
  @Post('provision')
  provision(@Body() dto: ProvisionWalletDto, @Request() req: any) {
    return this.walletsService.provisionTenantWallet(
      req.user.tenantId,
      dto.chain,
      dto.label,
    );
  }
}
