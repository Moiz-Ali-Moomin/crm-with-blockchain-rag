/**
 * AiLog — MongoDB collection for all LLM prompt/response pairs
 *
 * Why MongoDB (not PostgreSQL):
 * - `prompt` and `response` are unbounded text (can be 10k+ chars)
 * - `metadata` is schema-less — shape varies per operation type
 * - Volume: every AI call writes a log → high insert rate, rarely updated
 * - Analytics queries are time-range scans, not relational joins
 *
 * Multi-tenancy:
 * - tenantId is REQUIRED (string, not ObjectId — matches Prisma UUID)
 * - Compound index (tenantId + createdAt) ensures all queries are tenant-scoped
 *   and time-ordered without full collection scans
 *
 * Retention:
 * - Add a TTL index in production: { createdAt: 1 }, { expireAfterSeconds: 7776000 } (90 days)
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AiLogDocument = HydratedDocument<AiLog>;

/**
 * Supported operation types — constrains the operationType field
 * to prevent magic strings across the codebase.
 */
export type AiOperationType =
  | 'summarize_contact'
  | 'generate_email_reply'
  | 'suggest_follow_up'
  | 'summarize_activity'
  | 'semantic_search'
  | 'rag_query'
  | 'verify_deal'
  | 'embedding';

@Schema({
  collection: 'ai_logs',
  // Mongoose manages createdAt + updatedAt automatically
  timestamps: true,
  // Lean reads by default — avoids hydrating full Mongoose documents on reads
  // (applied per query in the repository via .lean())
})
export class AiLog {
  /**
   * Tenant isolation — EVERY document MUST have this.
   * Indexed for fast tenant-scoped queries.
   */
  @Prop({ type: String, required: true, index: true })
  tenantId: string;

  /**
   * Which AI operation produced this log.
   * Allows filtering logs by feature (e.g. "show me all email_reply costs").
   */
  @Prop({ type: String, required: true })
  operationType: AiOperationType;

  /**
   * The CRM entity this AI call was about (e.g. 'contact', 'lead', 'deal').
   * Optional — semantic search has no single entity.
   */
  @Prop({ type: String })
  entityType?: string;

  /**
   * The specific entity ID (Prisma UUID) this AI call was about.
   * Optional — same reason as entityType.
   */
  @Prop({ type: String })
  entityId?: string;

  /**
   * The user who triggered this AI call (Prisma UUID).
   * Optional — background workers may trigger AI without a user context.
   */
  @Prop({ type: String })
  userId?: string;

  /**
   * The full prompt / context string sent to the LLM.
   * Stored as-is for debugging + cost auditing.
   */
  @Prop({ type: String, required: true })
  prompt: string;

  /**
   * The raw model response (before JSON.parse).
   * Stored as string to handle cases where the model returns malformed JSON.
   */
  @Prop({ type: String, required: true })
  response: string;

  /**
   * Flexible metadata bag — shape is defined per operationType.
   *
   * Example shapes:
   *   summarize_contact:   { model, temperature, tokensUsed, cached: false }
   *   generate_email_reply: { model, temperature, tokensUsed, communicationId }
   *   suggest_follow_up:   { model, temperature, tokensUsed }
   *   semantic_search:      { model, embeddingDims, resultsCount, queryHash }
   */
  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;

  /**
   * Token counts for cost tracking.
   * Filled when available from the OpenAI response.
   */
  @Prop({ type: Number })
  promptTokens?: number;

  @Prop({ type: Number })
  completionTokens?: number;

  @Prop({ type: Number })
  totalTokens?: number;

  /**
   * Wall-clock latency in milliseconds for the LLM API call.
   * Used for p95/p99 latency dashboards.
   */
  @Prop({ type: Number })
  latencyMs?: number;

  /**
   * Whether the result was served from Redis cache (no LLM call made).
   * When true, prompt/response are still stored for audit but tokens = 0.
   */
  @Prop({ type: Boolean, default: false })
  servedFromCache: boolean;

  // createdAt and updatedAt injected by { timestamps: true }
  createdAt: Date;
  updatedAt: Date;
}

export const AiLogSchema = SchemaFactory.createForClass(AiLog);

// ─── Indexes ────────────────────────────────────────────────────────────────

/**
 * Primary access pattern: "get all AI logs for tenant X in the last 30 days"
 * This compound index covers both the tenant filter and the time sort.
 */
AiLogSchema.index({ tenantId: 1, createdAt: -1 });

/**
 * Secondary access pattern: "show me all email_reply logs for tenant X"
 */
AiLogSchema.index({ tenantId: 1, operationType: 1, createdAt: -1 });

/**
 * Entity-scoped access pattern: "show AI activity for this specific deal"
 */
AiLogSchema.index({ tenantId: 1, entityType: 1, entityId: 1, createdAt: -1 });

/**
 * Cost analytics: "how many tokens did tenant X use this month?"
 * Sparse because not all documents have token counts (cached results).
 */
AiLogSchema.index({ tenantId: 1, createdAt: -1, totalTokens: 1 }, { sparse: true });
