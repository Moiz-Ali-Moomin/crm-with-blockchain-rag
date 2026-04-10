/**
 * Custody Provider Abstraction
 *
 * We never store raw private keys. All signing operations go through a custody
 * provider. The interface is swappable: LocalCustodyAdapter for dev/test,
 * FireblocksCustodyAdapter for production.
 *
 * Injection token: CUSTODY_PROVIDER
 */

export const CUSTODY_PROVIDER = Symbol('CUSTODY_PROVIDER');

export type SupportedChain = 'POLYGON' | 'BASE' | 'ETHEREUM';

export interface CustodyWallet {
  /** EVM address (checksummed) */
  address: string;
  /** Opaque ID in the custody provider's system (Fireblocks vault account ID, etc.) */
  custodyId: string;
  /** Any provider-specific metadata */
  metadata?: Record<string, unknown>;
}

export interface CustodyTransferParams {
  /** Custody ID of the source wallet */
  fromCustodyId: string;
  /** Destination EVM address */
  toAddress: string;
  /** USDC amount in atomic units (6 decimals) as string — BigInt safe */
  amountRaw: string;
  /** Target chain */
  chain: SupportedChain;
  /** Provider-level idempotency key — prevents double-spend on retry */
  idempotencyKey: string;
  /** Token contract address (defaults to USDC on the given chain) */
  tokenAddress?: string;
}

export interface CustodyTransferResult {
  txHash: string;
  status: 'SUBMITTED' | 'FAILED';
  custodyTxId?: string; // Provider-internal transaction ID for reconciliation
}

export interface ICustodyProvider {
  /**
   * Generate a new custodial wallet.
   * Returns the address and provider-scoped ID — never a private key.
   */
  generateWallet(params: {
    tenantId: string;
    label?: string;
    chain: SupportedChain;
  }): Promise<CustodyWallet>;

  /**
   * Read the on-chain USDC balance for a custody wallet.
   * Returns raw amount as string (USDC 6 decimals).
   */
  getBalance(params: {
    custodyId: string;
    chain: SupportedChain;
    tokenAddress: string;
  }): Promise<string>;

  /**
   * Submit a USDC transfer.
   * Idempotent: same idempotencyKey must return the same result.
   */
  transfer(params: CustodyTransferParams): Promise<CustodyTransferResult>;
}
