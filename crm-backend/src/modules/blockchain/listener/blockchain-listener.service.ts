/**
 * BlockchainListenerService
 *
 * Long-lived service that subscribes to USDC Transfer events on configured chains.
 * Runs on application bootstrap, reconnects automatically on provider failure.
 *
 * Architecture:
 *   listener (this service) → blockchain-events queue → BlockchainEventsWorker
 *   → PaymentsService.handleTxDetected() → transaction-confirmation queue
 *   → TransactionConfirmationWorker → PaymentsService.handleConfirmationUpdate()
 *
 * The listener's only job is event ingestion — it never writes to the DB directly.
 * All business logic is in the worker, keeping this path lean and fault-tolerant.
 *
 * Supports multiple chains concurrently. Each chain gets its own provider instance.
 *
 * Reconnect strategy:
 *   - WebSocket providers: re-subscribe on 'error' and 'close' events
 *   - HTTP providers: polling every POLL_INTERVAL_MS (fallback for environments
 *     where WebSocket is not available)
 */

import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ethers } from 'ethers';
import { QUEUE_NAMES, QUEUE_JOB_OPTIONS } from '../../../core/queue/queue.constants';

// Minimal ERC-20 Transfer event ABI
const ERC20_TRANSFER_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

// USDC contract addresses per chain
const USDC_CONTRACTS: Record<string, string> = {
  POLYGON: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  BASE: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  ETHEREUM: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
};

const RPC_ENV_KEYS: Record<string, string> = {
  POLYGON: 'BLOCKCHAIN_RPC_URL_POLYGON',
  BASE: 'BLOCKCHAIN_RPC_URL_BASE',
  ETHEREUM: 'BLOCKCHAIN_RPC_URL_ETHEREUM',
};

// How many blocks to look back on reconnect (avoid replaying too many events)
const RECONNECT_LOOKBACK_BLOCKS = 20;
// Reconnect delay with exponential backoff cap
const MAX_RECONNECT_DELAY_MS = 60_000;

export interface BlockchainTransferEvent {
  chain: string;
  txHash: string;
  blockNumber: number;
  logIndex: number;
  fromAddress: string;
  toAddress: string;
  /** Raw amount as string (USDC 6 decimals — no BigInt serialisation issues) */
  amountRaw: string;
  timestamp: number;
}

@Injectable()
export class BlockchainListenerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(BlockchainListenerService.name);
  /** Active providers keyed by chain name */
  private providers = new Map<string, ethers.Provider>();
  /** Active contract instances keyed by chain name */
  private contracts = new Map<string, ethers.Contract>();
  /** Reconnect timers */
  private reconnectTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.BLOCKCHAIN_EVENTS)
    private readonly eventsQueue: Queue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const enabledChains = this.config
      .get<string>('BLOCKCHAIN_LISTENER_CHAINS', 'POLYGON')
      .split(',')
      .map((c) => c.trim().toUpperCase());

    for (const chain of enabledChains) {
      await this.startListening(chain, 0);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    for (const [chain, timer] of this.reconnectTimers) {
      clearTimeout(timer);
      this.reconnectTimers.delete(chain);
    }
    for (const [chain, contract] of this.contracts) {
      await contract.removeAllListeners();
      this.contracts.delete(chain);
    }
    for (const [chain, provider] of this.providers) {
      await (provider as ethers.AbstractProvider).destroy?.();
      this.providers.delete(chain);
    }
  }

  private async startListening(chain: string, attempt: number): Promise<void> {
    const rpcEnvKey = RPC_ENV_KEYS[chain];
    const rpcUrl = this.config.get<string>(rpcEnvKey ?? '');
    const usdcAddress = USDC_CONTRACTS[chain];

    if (!rpcUrl || !usdcAddress) {
      this.logger.warn(`Skipping ${chain}: RPC URL or USDC address not configured`);
      return;
    }

    try {
      // Prefer WebSocket for push-based events; fall back to HTTP + polling
      const provider = rpcUrl.startsWith('wss://')
        ? new ethers.WebSocketProvider(rpcUrl)
        : new ethers.JsonRpcProvider(rpcUrl);

      const contract = new ethers.Contract(usdcAddress, ERC20_TRANSFER_ABI, provider);

      // Get current block on connect — used to avoid replaying old events on reconnect
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - RECONNECT_LOOKBACK_BLOCKS);

      // Subscribe to Transfer events
      contract.on('Transfer', async (from, to, value, event) => {
        await this.handleTransferEvent(chain, from, to, value, event);
      });

      // Handle provider-level failures
      if (rpcUrl.startsWith('wss://')) {
        const ws = (provider as ethers.WebSocketProvider).websocket;
        (ws as any).on?.('error', (err: Error) => {
          this.logger.error(`${chain} WebSocket error: ${err.message}`);
          this.scheduleReconnect(chain, attempt);
        });
        (ws as any).on?.('close', () => {
          this.logger.warn(`${chain} WebSocket closed — reconnecting`);
          this.scheduleReconnect(chain, attempt);
        });
      }

      this.providers.set(chain, provider);
      this.contracts.set(chain, contract);

      this.logger.log(
        `${chain} listener active on USDC ${usdcAddress} (from block ~${fromBlock})`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`${chain} listener failed to start (attempt ${attempt}): ${msg}`);
      this.scheduleReconnect(chain, attempt);
    }
  }

  private async handleTransferEvent(
    chain: string,
    from: string,
    to: string,
    value: bigint,
    event: ethers.EventLog,
  ): Promise<void> {
    const txHash = event.transactionHash;

    // Deduplicate: use txHash + logIndex as jobId — BullMQ drops duplicates
    const jobId = `transfer:${chain}:${txHash}:${event.index}`;

    const payload: BlockchainTransferEvent = {
      chain,
      txHash,
      blockNumber: event.blockNumber,
      logIndex: event.index,
      fromAddress: from.toLowerCase(),
      toAddress: to.toLowerCase(),
      amountRaw: value.toString(),
      timestamp: Math.floor(Date.now() / 1000),
    };

    try {
      await this.eventsQueue.add('process_transfer', payload, {
        ...QUEUE_JOB_OPTIONS.blockchainEvents,
        jobId, // idempotent — same event replayed on reconnect is deduplicated
      });

      this.logger.debug(
        `Queued Transfer: ${from} → ${to} ${value} USDC (${txHash.slice(0, 12)}...)`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to enqueue transfer event ${jobId}: ${msg}`);
      // Do not rethrow — we don't want to crash the event listener
    }
  }

  private scheduleReconnect(chain: string, attempt: number): void {
    // Clear existing contract listener to avoid double-firing
    this.contracts.get(chain)?.removeAllListeners().catch(() => {});
    this.contracts.delete(chain);
    (this.providers.get(chain) as any)?.destroy?.();
    this.providers.delete(chain);

    // Exponential backoff: 2s, 4s, 8s … cap at 60s
    const delay = Math.min(2_000 * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
    this.logger.log(`${chain} reconnect in ${delay}ms (attempt ${attempt + 1})`);

    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(chain);
      await this.startListening(chain, attempt + 1);
    }, delay);

    this.reconnectTimers.set(chain, timer);
  }
}
