/**
 * AiLogRepository — MongoDB repository for AI operation logs
 *
 * Follows the same repository pattern as Prisma repositories:
 * - No business logic — only DB read/write operations
 * - Receives tenantId explicitly on every method (MongoDB has no AsyncLocalStorage middleware)
 * - All queries MUST include { tenantId } filter — enforced by TypeScript signatures
 *
 * The service layer calls this repository. CopilotService uses it fire-and-forget.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiLog, AiLogDocument, AiOperationType } from '../schemas/ai-log.schema';

export interface CreateAiLogDto {
  tenantId: string;                      // REQUIRED — never omit
  operationType: AiOperationType;
  prompt: string;
  response: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  servedFromCache?: boolean;
}

export interface FindAiLogsFilter {
  tenantId: string;                      // REQUIRED — always scoped
  operationType?: AiOperationType;
  entityType?: string;
  entityId?: string;
  userId?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  skip?: number;
}

export interface AiUsageStats {
  totalCalls: number;
  totalTokens: number;
  cachedCalls: number;
  avgLatencyMs: number;
  byOperation: Record<string, { calls: number; tokens: number }>;
}

@Injectable()
export class AiLogRepository {
  private readonly logger = new Logger(AiLogRepository.name);

  constructor(
    @InjectModel(AiLog.name)
    private readonly aiLogModel: Model<AiLogDocument>,
  ) {}

  /**
   * Persist one AI log entry.
   * Called fire-and-forget from CopilotService — must NEVER throw unhandled.
   * Returns null on error so callers can safely discard the result.
   */
  async create(dto: CreateAiLogDto): Promise<AiLogDocument | null> {
    try {
      const doc = new this.aiLogModel({
        ...dto,
        servedFromCache: dto.servedFromCache ?? false,
        metadata: dto.metadata ?? {},
      });
      return await doc.save();
    } catch (err) {
      // Log but never propagate — a logging failure must NOT break the CRM response
      this.logger.error('Failed to write AI log to MongoDB', {
        error: (err as Error).message,
        tenantId: dto.tenantId,
        operationType: dto.operationType,
      });
      return null;
    }
  }

  /**
   * Find AI logs for a tenant with optional filters.
   * Uses .lean() for read performance — returns plain JS objects, not Mongoose docs.
   */
  async findMany(filter: FindAiLogsFilter): Promise<AiLog[]> {
    const query: Record<string, unknown> = { tenantId: filter.tenantId };

    if (filter.operationType) query.operationType = filter.operationType;
    if (filter.entityType)    query.entityType    = filter.entityType;
    if (filter.entityId)      query.entityId      = filter.entityId;
    if (filter.userId)        query.userId        = filter.userId;

    if (filter.fromDate || filter.toDate) {
      query.createdAt = {
        ...(filter.fromDate && { $gte: filter.fromDate }),
        ...(filter.toDate   && { $lte: filter.toDate }),
      };
    }

    return this.aiLogModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(filter.skip ?? 0)
      .limit(filter.limit ?? 50)
      .lean()
      .exec() as Promise<AiLog[]>;
  }

  /**
   * Count logs for a tenant — used for pagination meta.
   */
  async count(filter: Pick<FindAiLogsFilter, 'tenantId' | 'operationType' | 'fromDate' | 'toDate'>): Promise<number> {
    const query: Record<string, unknown> = { tenantId: filter.tenantId };

    if (filter.operationType) query.operationType = filter.operationType;
    if (filter.fromDate || filter.toDate) {
      query.createdAt = {
        ...(filter.fromDate && { $gte: filter.fromDate }),
        ...(filter.toDate   && { $lte: filter.toDate }),
      };
    }

    return this.aiLogModel.countDocuments(query).exec();
  }

  /**
   * Token usage + latency stats for a tenant over a time window.
   *
   * Uses MongoDB aggregation pipeline:
   *  1. Match tenant + date range
   *  2. Group by operationType to get per-feature breakdown
   *  3. $facet gives us totals + per-operation breakdown in one round-trip
   */
  async getUsageStats(
    tenantId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<AiUsageStats> {
    const pipeline = [
      {
        $match: {
          tenantId,
          createdAt: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $facet: {
          // Overall totals
          totals: [
            {
              $group: {
                _id: null,
                totalCalls:    { $sum: 1 },
                totalTokens:   { $sum: { $ifNull: ['$totalTokens', 0] } },
                cachedCalls:   { $sum: { $cond: ['$servedFromCache', 1, 0] } },
                avgLatencyMs:  { $avg: { $ifNull: ['$latencyMs', 0] } },
              },
            },
          ],
          // Per-operation breakdown
          byOperation: [
            {
              $group: {
                _id:    '$operationType',
                calls:  { $sum: 1 },
                tokens: { $sum: { $ifNull: ['$totalTokens', 0] } },
              },
            },
          ],
        },
      },
    ];

    const [result] = await this.aiLogModel.aggregate(pipeline).exec();

    const totals = result?.totals?.[0] ?? {
      totalCalls: 0,
      totalTokens: 0,
      cachedCalls: 0,
      avgLatencyMs: 0,
    };

    const byOperation: Record<string, { calls: number; tokens: number }> = {};
    for (const op of (result?.byOperation ?? [])) {
      byOperation[op._id] = { calls: op.calls, tokens: op.tokens };
    }

    return {
      totalCalls:   totals.totalCalls,
      totalTokens:  totals.totalTokens,
      cachedCalls:  totals.cachedCalls,
      avgLatencyMs: Math.round(totals.avgLatencyMs),
      byOperation,
    };
  }
}
