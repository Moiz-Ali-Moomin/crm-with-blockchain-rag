import { z } from 'zod';

export const VerifyDealSchema = z.object({
  dealId: z.string().uuid(),
});
export type VerifyDealDto = z.infer<typeof VerifyDealSchema>;

export const GetBlockchainRecordSchema = z.object({
  dealId: z.string().uuid(),
});
export type GetBlockchainRecordDto = z.infer<typeof GetBlockchainRecordSchema>;

// ── Internal: Job payload enqueued by deals.service.ts ────────────────────────

export interface BlockchainJobPayload {
  tenantId: string;
  entityType: 'DEAL';
  entityId: string;
  /** Pre-computed keccak256 hash of the deal payload (hex, no 0x prefix) */
  dataHash: string;
  /** Serialised deal snapshot used to produce the hash (for audit log) */
  payloadSnapshot: Record<string, unknown>;
}
