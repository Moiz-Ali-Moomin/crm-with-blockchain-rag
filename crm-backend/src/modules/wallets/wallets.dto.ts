import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Chain } from '@prisma/client';

export class ProvisionWalletDto {
  @IsEnum(Chain)
  @IsOptional()
  chain?: Chain = 'POLYGON';

  @IsString()
  @IsOptional()
  label?: string;
}
