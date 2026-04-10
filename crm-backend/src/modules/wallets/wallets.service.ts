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

import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
}
