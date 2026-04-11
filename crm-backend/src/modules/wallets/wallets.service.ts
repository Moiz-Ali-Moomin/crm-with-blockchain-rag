/**
 * WalletsService
 *
 * Owns the lifecycle of custodial wallets:
 *   - Generate new wallets via the custody provider
 *   - Keep off-chain balance cache in sync
 *   - Expose balance for payments and the CFO agent
 *
 * One Wallet row = one custody account on one chain.
 * Multi-chain: create one Wallet per (tenantId, chain) combination.
 */

import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Chain, Wallet, WalletType } from '@prisma/client';
import {
  CUSTODY_PROVIDER,
  ICustodyProvider,
  SupportedChain,
} from '../blockchain/custody/custody.interface';
import { WalletsRepository } from './wallets.repository';
import { LedgerService } from '../ledger/ledger.service';

// Canonical USDC addresses per chain
export const USDC_ADDRESSES: Record<SupportedChain, string> = {
  POLYGON: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  BASE: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  ETHEREUM: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
};

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);

  constructor(
    private readonly walletsRepo: WalletsRepository,
    @Inject(CUSTODY_PROVIDER) private readonly custody: ICustodyProvider,
    private readonly ledger: LedgerService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Provision a new custodial wallet for a tenant.
   * Idempotent for (tenantId, type, chain): returns existing if found.
   */
  async provisionTenantWallet(
    tenantId: string,
    chain: Chain = 'POLYGON',
    label?: string,
  ): Promise<Wallet> {
    const existing = await this.walletsRepo.findTenantOperatingWallet(tenantId, chain);
    if (existing) return existing;

    const custodyWallet = await this.custody.generateWallet({
      tenantId,
      chain: chain as SupportedChain,
      label: label ?? `tenant-operating-${tenantId.slice(0, 8)}`,
    });

    const wallet = await this.walletsRepo.create({
      tenantId,
      type: WalletType.TENANT,
      chain,
      address: custodyWallet.address,
      custodyId: custodyWallet.custodyId,
      custodyProvider: this.config.get('CUSTODY_PROVIDER', 'local'),
      label,
      metadata: custodyWallet.metadata,
    });

    // Bootstrap chart of accounts for this wallet
    await this.ledger.ensureWalletAccounts(tenantId, wallet.id, chain as SupportedChain);

    this.logger.log(
      `Provisioned ${chain} wallet for tenant ${tenantId}: ${custodyWallet.address}`,
    );

    return wallet;
  }

  async findById(id: string, tenantId: string): Promise<Wallet> {
    const wallet = await this.walletsRepo.findById(id, tenantId);
    if (!wallet) throw new NotFoundException(`Wallet ${id} not found`);
    return wallet;
  }

  async findByTenant(tenantId: string): Promise<Wallet[]> {
    return this.walletsRepo.findByTenant(tenantId);
  }

  /**
   * Sync on-chain USDC balance into the off-chain cache.
   * Called by the balance-sync cron job and on-demand by the API.
   */
  async syncBalance(walletId: string, tenantId: string): Promise<{ balanceUsdc: string }> {
    const wallet = await this.findById(walletId, tenantId);

    if (!wallet.custodyId) {
      return { balanceUsdc: wallet.balanceUsdc.toString() };
    }

    const tokenAddress = USDC_ADDRESSES[wallet.chain as SupportedChain];
    const rawBalance = await this.custody.getBalance({
      custodyId: wallet.custodyId,
      chain: wallet.chain as SupportedChain,
      tokenAddress,
    });

    await this.walletsRepo.updateBalanceCache(walletId, rawBalance);

    const humanBalance = (Number(rawBalance) / 1_000_000).toFixed(6);
    this.logger.log(`Balance synced for wallet ${walletId}: ${humanBalance} USDC`);

    return { balanceUsdc: humanBalance };
  }

  /** Used by the blockchain listener to match inbound deposits to wallets. */
  async findByAddress(address: string, chain: Chain): Promise<Wallet | null> {
    return this.walletsRepo.findByAddress(address, chain);
  }

  /**
   * Submit an outbound USDC transfer from a custodial wallet.
   *
   * Validates:
   *   1. Wallet is ACTIVE and belongs to this tenant
   *   2. Off-chain balance cache covers the requested amount (guard — on-chain is authoritative)
   *   3. Amount is positive
   *
   * Submits the transfer to the custody provider (Fireblocks or local dev wallet).
   * Returns the custody provider's transaction result so the caller can track it.
   *
   * Note: the off-chain balance cache is NOT updated here — it will be refreshed
   * by the next balance-sync cron cycle or an explicit GET /wallets/:id/balance call.
   */
  async withdraw(
    walletId: string,
    tenantId: string,
    params: {
      toAddress: string;
      amountUsdc: string;
      idempotencyKey: string;
    },
  ) {
    const wallet = await this.findById(walletId, tenantId);

    if (wallet.status !== 'ACTIVE') {
      throw new BadRequestException(`Wallet ${walletId} is ${wallet.status} — cannot withdraw`);
    }

    const amountDecimal = new Prisma.Decimal(params.amountUsdc);
    if (amountDecimal.lte(0)) {
      throw new BadRequestException('Withdrawal amount must be greater than zero');
    }

    // Off-chain balance check (best-effort guard — on-chain is the source of truth)
    if ((wallet.balanceUsdc as Prisma.Decimal).lt(amountDecimal)) {
      throw new BadRequestException(
        `Insufficient balance: ${wallet.balanceUsdc} USDC available, ` +
        `${params.amountUsdc} USDC requested`,
      );
    }

    if (!wallet.custodyId) {
      throw new BadRequestException(`Wallet ${walletId} has no custody ID — cannot sign transfers`);
    }

    // Convert human amount (6 dp) → atomic units (raw integer string)
    const amountRaw = amountDecimal.mul(new Prisma.Decimal('1000000')).toFixed(0);

    const tokenAddress = USDC_ADDRESSES[wallet.chain as SupportedChain];

    const result = await this.custody.transfer({
      fromCustodyId: wallet.custodyId,
      toAddress:     params.toAddress,
      amountRaw,
      chain:         wallet.chain as SupportedChain,
      idempotencyKey: params.idempotencyKey,
      tokenAddress,
    });

    this.logger.log(
      `Withdrawal submitted from wallet ${walletId} (tenant: ${tenantId}): ` +
      `${params.amountUsdc} USDC → ${params.toAddress} | ` +
      `txHash: ${result.txHash} | status: ${result.status}`,
    );

    return {
      txHash:       result.txHash,
      status:       result.status,
      custodyTxId:  result.custodyTxId ?? null,
      fromAddress:  wallet.address,
      toAddress:    params.toAddress,
      amountUsdc:   params.amountUsdc,
      chain:        wallet.chain,
    };
  }
}
