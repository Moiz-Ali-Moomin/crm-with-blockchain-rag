import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { Chain } from '@prisma/client';

export class ProvisionWalletDto {
  @IsEnum(Chain)
  @IsOptional()
  chain?: Chain = 'POLYGON';

  @IsString()
  @IsOptional()
  label?: string;
}

export class WithdrawDto {
  /** Destination EVM address for the USDC transfer */
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[0-9a-fA-F]{40}$/, { message: 'toAddress must be a valid EVM address' })
  toAddress: string;

  /** USDC amount as a decimal string, e.g. "50.00" */
  @IsString()
  @IsNotEmpty()
  amountUsdc: string;

  /**
   * Caller-provided idempotency key — prevents double-spend on retry.
   * Use a UUID or a unique string per withdrawal attempt.
   */
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}
