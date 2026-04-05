/**
 * BlockchainService
 *
 * Manages deal hash registration on EVM-compatible chains via ethers.js v6.
 *
 * What we write on-chain:
 *   keccak256(abi.encode(tenantId, dealId, title, value, currency, wonAt, ownerId))
 * Never raw PII — just a deterministic fingerprint of the deal's final state.
 *
 * The on-chain operation is ALWAYS async (enqueued via BullMQ).
 * The DB record is created synchronously so the UI can show "PENDING" immediately.
 *
 * Prerequisites:
 *   BLOCKCHAIN_RPC_URL      — e.g. https://rpc-mumbai.maticvigil.com
 *   BLOCKCHAIN_PRIVATE_KEY  — signer wallet private key (hex, with 0x)
 *   BLOCKCHAIN_CONTRACT_ADDR — deployed DealHashRegistry address
 *   BLOCKCHAIN_NETWORK      — e.g. "polygon-mumbai"
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { BlockchainRepository } from './blockchain.repository';

// Minimal ABI — only the functions we actually call
const DEAL_REGISTRY_ABI = [
  'function registerDeal(string tenantId, string dealId, bytes32 dataHash) external',
  'function verifyDeal(string tenantId, string dealId, bytes32 dataHash) external view returns (bool isValid, uint256 registeredAt, uint256 atBlock)',
  'function getDealRecord(string tenantId, string dealId) external view returns (bytes32 dataHash, uint256 timestamp, uint256 blockNumber)',
] as const;

export interface DealPayloadForHash {
  tenantId: string;
  dealId: string;
  title: string;
  value: string;        // Decimal serialised as string (lossless)
  currency: string;
  wonAt: string;        // ISO date string
  ownerId: string | null;
  pipelineId: string;
}

// Timeout for tx.wait() — EVM networks can stall; 2 min is enough for 1 confirmation
const TX_CONFIRMATION_TIMEOUT_MS = 120_000;

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  readonly network: string; // exposed for BlockchainWorker

  // Lazily-initialised write signer (reused across jobs — avoids per-call provider creation)
  private _writeContract: ethers.Contract | null = null;
  // Lazily-initialised read-only provider (no private key needed)
  private _readContract: ethers.Contract | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly blockchainRepo: BlockchainRepository,
  ) {
    this.network = this.config.get<string>('BLOCKCHAIN_NETWORK', 'polygon-mumbai');
  }

  /** Returns the write contract (with signer) — lazily created and reused. */
  private getWriteContract(): ethers.Contract | null {
    if (this._writeContract) return this._writeContract;

    const rpcUrl     = this.config.get<string>('BLOCKCHAIN_RPC_URL');
    const privateKey = this.config.get<string>('BLOCKCHAIN_PRIVATE_KEY');
    const addr       = this.config.get<string>('BLOCKCHAIN_CONTRACT_ADDR');

    if (!rpcUrl || !privateKey || !addr) return null;

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer   = new ethers.Wallet(privateKey, provider);
    this._writeContract = new ethers.Contract(addr, DEAL_REGISTRY_ABI, signer);
    return this._writeContract;
  }

  /** Returns the read-only contract — lazily created and reused. */
  private getReadContract(): ethers.Contract | null {
    if (this._readContract) return this._readContract;

    const rpcUrl = this.config.get<string>('BLOCKCHAIN_RPC_URL');
    const addr   = this.config.get<string>('BLOCKCHAIN_CONTRACT_ADDR');

    if (!rpcUrl || !addr) return null;

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    this._readContract = new ethers.Contract(addr, DEAL_REGISTRY_ABI, provider);
    return this._readContract;
  }

  // ─── Hash Utilities (deterministic, no network call) ──────────────────────

  /**
   * Compute the keccak256 hash of a deal's canonical fields.
   * This is what gets stored on-chain.
   *
   * The ABI-encoded format ensures byte-level determinism regardless of
   * JSON serialisation order.
   */
  computeDealHash(payload: DealPayloadForHash): string {
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['string', 'string', 'string', 'string', 'string', 'string', 'string', 'string'],
      [
        payload.tenantId,
        payload.dealId,
        payload.title,
        payload.value,
        payload.currency,
        payload.wonAt,
        payload.ownerId ?? '',
        payload.pipelineId,
      ],
    );
    return ethers.keccak256(encoded); // returns '0x...' hex
  }

  // ─── On-chain Write (called by BlockchainWorker) ───────────────────────────

  /**
   * Register the deal hash on-chain and update the DB record.
   * Called exclusively by BlockchainWorker — never on the HTTP request path.
   *
   * @param recordId  — DB `blockchain_records.id` to update after confirmation
   * @param tenantId  — CRM tenant UUID
   * @param dealId    — CRM deal UUID
   * @param dataHash  — hex keccak256 hash (0x-prefixed)
   */
  async registerOnChain(
    recordId: string,
    tenantId: string,
    dealId: string,
    dataHash: string,
  ): Promise<void> {
    const contract = this.getWriteContract();

    if (!contract) {
      this.logger.warn(
        'Blockchain env vars not configured. Skipping on-chain registration.',
      );
      await this.blockchainRepo.fail(
        recordId,
        'Blockchain not configured (missing env vars)',
      );
      return;
    }

    this.logger.log(
      `Registering deal ${dealId} on ${this.network} (hash: ${dataHash.slice(0, 10)}...)`,
    );

    // Convert hex string to bytes32
    const bytes32Hash = ethers.hexlify(dataHash) as `0x${string}`;

    const tx: ethers.TransactionResponse = await (contract as any).registerDeal(
      tenantId,
      dealId,
      bytes32Hash,
    );

    this.logger.log(`Tx submitted: ${tx.hash} — waiting for confirmation...`);

    // Guard against tx.wait() hanging indefinitely (network stall, dropped tx)
    const receipt = await Promise.race([
      tx.wait(1),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`tx.wait timed out after ${TX_CONFIRMATION_TIMEOUT_MS}ms: ${tx.hash}`)),
          TX_CONFIRMATION_TIMEOUT_MS,
        ),
      ),
    ]);

    if (!receipt || receipt.status !== 1) {
      throw new Error(`Transaction reverted: ${tx.hash}`);
    }

    await this.blockchainRepo.confirm(
      recordId,
      tx.hash,
      BigInt(receipt.blockNumber),
      receipt.gasUsed.toString(),
    );

    this.logger.log(
      `Deal ${dealId} confirmed on-chain: block ${receipt.blockNumber}, tx ${tx.hash}`,
    );
  }

  // ─── Verification (read-only, no gas) ─────────────────────────────────────

  /**
   * Verify a deal's hash against what is stored on-chain.
   * Called by the controller — uses a read-only provider (no wallet needed).
   */
  async verifyDealOnChain(
    tenantId: string,
    dealId: string,
  ): Promise<{
    isValid: boolean;
    storedHash: string;
    registeredAt: Date | null;
    blockNumber: number | null;
    txHash: string | null;
    network: string;
  }> {
    const record = await this.blockchainRepo.findByDeal(tenantId, dealId);

    if (!record || record.status !== 'CONFIRMED') {
      return {
        isValid: false,
        storedHash: record?.dataHash ?? '',
        registeredAt: null,
        blockNumber: null,
        txHash: record?.txHash ?? null,
        network: this.network,
      };
    }

    const contract = this.getReadContract();

    if (!contract) {
      // Can still return DB state as partial verification
      return {
        isValid: true,
        storedHash: record.dataHash,
        registeredAt: record.createdAt,
        blockNumber: record.blockNumber ? Number(record.blockNumber) : null,
        txHash: record.txHash,
        network: this.network,
      };
    }

    const [onChainHash, timestamp, blockNumber] = await (contract as any).getDealRecord(
      tenantId,
      dealId,
    );

    const isValid =
      onChainHash !== ethers.ZeroHash &&
      onChainHash.toLowerCase() === record.dataHash.toLowerCase();

    return {
      isValid,
      storedHash: onChainHash,
      registeredAt: timestamp > 0 ? new Date(Number(timestamp) * 1000) : null,
      blockNumber: blockNumber > 0 ? Number(blockNumber) : null,
      txHash: record.txHash,
      network: this.network,
    };
  }
}
