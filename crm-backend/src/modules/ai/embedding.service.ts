/**
 * EmbeddingService
 *
 * Generates text embeddings via OpenAI `text-embedding-3-small` and persists
 * them in `ai_embeddings` (pgvector column added via raw migration).
 *
 * Design decisions:
 * - Upsert on (tenantId, entityType, entityId) — re-indexing is idempotent
 * - Uses `prisma.$executeRaw` to write the vector column (Prisma doesn't support
 *   the pgvector `vector` type natively in the schema DSL)
 * - Never called on the hot path — always enqueued via AiEmbeddingWorker
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly openai: OpenAI;
  private readonly model = 'text-embedding-3-small'; // 1536 dims, cheapest
  private readonly DIMENSIONS = 1536;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Generate an embedding vector for the given text.
   * Returns float32[] of length 1536.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // Truncate to ~8000 tokens (model limit) — a rough char approximation
    const truncated = text.slice(0, 30000);

    const response = await this.openai.embeddings.create({
      model: this.model,
      input: truncated,
      dimensions: this.DIMENSIONS,
    });

    return response.data[0].embedding;
  }

  /**
   * Upsert embedding record.
   *
   * Two-step process:
   * 1. Upsert the row in `ai_embeddings` via Prisma ORM (all non-vector columns)
   * 2. Write the vector column via raw SQL (pgvector extension requirement)
   */
  async upsertEmbedding(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
    content: string;
    embedding: number[];
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { tenantId, entityType, entityId, content, embedding, metadata } = params;

    // Step 1: upsert non-vector fields via ORM
    await this.prisma.withoutTenantScope(() =>
      this.prisma.aiEmbedding.upsert({
        where: {
          tenantId_entityType_entityId: { tenantId, entityType, entityId },
        },
        create: {
          tenantId,
          entityType,
          entityId,
          content,
          metadata: (metadata ?? {}) as any,
        },
        update: {
          content,
          metadata: (metadata ?? {}) as any,
          updatedAt: new Date(),
        },
      }),
    );

    // Step 2: write the vector column via raw SQL
    // pgvector expects the array as '[x,x,x,...]'::vector
    const vectorLiteral = `[${embedding.join(',')}]`;

    await this.prisma.$executeRaw`
      UPDATE ai_embeddings
      SET embedding = ${vectorLiteral}::vector
      WHERE tenant_id  = ${tenantId}
        AND entity_type = ${entityType}
        AND entity_id   = ${entityId}
    `;

    this.logger.debug(
      `Embedding upserted: ${entityType}/${entityId} (tenant: ${tenantId})`,
    );
  }

  /**
   * Delete embedding when the source entity is deleted.
   * Called by workers — bypasses tenant scope.
   */
  async deleteEmbedding(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<void> {
    await this.prisma.withoutTenantScope(() =>
      this.prisma.aiEmbedding.deleteMany({
        where: { tenantId, entityType, entityId },
      }),
    );
  }
}
