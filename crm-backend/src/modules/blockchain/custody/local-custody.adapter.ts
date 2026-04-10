/**
 * LocalCustodyAdapter
 *
 * Development/test custody adapter. Uses an in-memory map of HD-derived wallets.
 * NEVER use in production — private keys are held in memory.
 *
 * Required env:
 *   CUSTODY_LOCAL_MNEMONIC — BIP39 mnemonic for HD wallet derivation
 *   BLOCKCHAIN_RPC_URL_POLYGON — RPC to read balances
 *
 * Address derivation: m/44'/60'/{tenantIndex}'/0/{walletIndex}
 * Each tenant gets a unique derivation index stored in a local map.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import {
  ICustodyProvider,
  CustodyWallet,
  CustodyTransferParams,
  CustodyTransferResult,
  SupportedChain,
} from './custody.interface';

const USDC_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

const CHAIN_TO_RPC_ENV: Record<SupportedChain, string> = {
  POLYGON: 'BLOCKCHAIN_RPC_URL_POLYGON',
  BASE: 'BLOCKCHAIN_RPC_URL_BASE',
  ETHEREUM: 'BLOCKCHAIN_RPC_URL_ETHEREUM',
};

const CHAIN_TO_USDC: Record<SupportedChain, string> = {
  POLYGON: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // USDC native on Polygon PoS
  BASE: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  ETHEREUM: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
};

@Injectable()
export class LocalCustodyAdapter implements ICustodyProvider {
  private readonly logger = new Logger(LocalCustodyAdapter.name);
  private readonly hdNode: ethers.HDNodeWallet;
  /** custodyId → derived wallet index */
  private readonly walletIndex = new Map<string, number>();
  private walletCounter = 0;

  constructor(private readonly config: ConfigService) {
    const mnemonic = config.get<string>(
      'CUSTODY_LOCAL_MNEMONIC',
      // DO NOT use this mnemonic anywhere near real funds
      'test test test test test test test test test test test junk',
    );
    this.hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic);
    this.logger.warn(
      'LocalCustodyAdapter active — for development only. Do NOT use in production.',
    );
  }

  async generateWallet(params: {
    tenantId: string;
    label?: string;
    chain: SupportedChain;
  }): Promise<CustodyWallet> {
    const index = this.walletCounter++;
    const custodyId = `local-${params.tenantId}-${index}`;
    this.walletIndex.set(custodyId, index);

    const derived = this.hdNode.derivePath(`m/44'/60'/${index}'/0/0`);
    this.logger.log(`Generated local wallet [${index}]: ${derived.address}`);

    return {
      address: derived.address,
      custodyId,
      metadata: { derivationIndex: index },
    };
  }

  async getBalance(params: {
    custodyId: string;
    chain: SupportedChain;
    tokenAddress: string;
  }): Promise<string> {
    const wallet = this.getDerivedWallet(params.custodyId, params.chain);
    const usdc = new ethers.Contract(params.tokenAddress, USDC_ABI, wallet.provider);
    const raw: bigint = await usdc.balanceOf(wallet.address);
    return raw.toString();
  }

  async transfer(params: CustodyTransferParams): Promise<CustodyTransferResult> {
    const wallet = this.getDerivedWallet(params.fromCustodyId, params.chain);
    const tokenAddress = params.tokenAddress ?? CHAIN_TO_USDC[params.chain];
    const usdc = new ethers.Contract(tokenAddress, USDC_ABI, wallet);

    try {
      const tx = await usdc.transfer(params.toAddress, BigInt(params.amountRaw));
      this.logger.log(`Local transfer submitted: ${tx.hash}`);
      return { txHash: tx.hash, status: 'SUBMITTED' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Local transfer failed: ${msg}`);
      return { txHash: '', status: 'FAILED' };
    }
  }

  private getDerivedWallet(custodyId: string, chain: SupportedChain): ethers.Wallet {
    const index = this.walletIndex.get(custodyId);
    if (index === undefined) throw new Error(`Unknown custodyId: ${custodyId}`);

    const rpcEnvKey = CHAIN_TO_RPC_ENV[chain];
    const rpcUrl = this.config.getOrThrow<string>(rpcEnvKey);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const derived = this.hdNode.derivePath(`m/44'/60'/${index}'/0/0`);
    return new ethers.Wallet(derived.privateKey, provider);
  }
}
