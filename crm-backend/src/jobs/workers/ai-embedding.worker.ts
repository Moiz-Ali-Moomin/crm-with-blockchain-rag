/**
 * AiEmbeddingWorker
 *
 * Processes the `ai-embedding` BullMQ queue.
 * Called asynchronously after activities, communications, and tickets are created.
 *
 * Responsibilities:
 * 1. Receive the raw text content + entity metadata
 * 2. Call OpenAI to generate a 1536-dim embedding vector
 * 3. Upsert into `ai_embeddings` (Prisma row + pgvector column via raw SQL)
 *
 * Worker design:
 * - Uses `prisma.withoutTenantScope()` — no HTTP context in worker process
 * - UnrecoverableError on config failures (missing API key) — don't retry
 * - Retryable errors (OpenAI rate-limit 429, network) → BullMQ handles exponential backoff
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from '../../core/queue/queue.constants';
import { EmbeddingService } from '../../modules/ai/embedding.service';
import { EmbeddingJobPayload } from '../../modules/ai/ai.dto';

@Processor(QUEUE_NAMES.AI_EMBEDDING)
export class AiEmbeddingWorker extends WorkerHost {
  private readonly logger = new Logger(AiEmbeddingWorker.name);

  constructor(
    private readonly config: ConfigService,
    private readonly embeddingService: EmbeddingService,
  ) {
    super();
  }

  async process(job: Job<EmbeddingJobPayload>): Promise<void> {
    const { tenantId, entityType, entityId, content, metadata, action = 'upsert' } = job.data;

    // ── Delete path ────────────────────────────────────────────────────────
    if (action === 'delete') {
      this.logger.debug(
        `Deleting embedding: ${entityType}/${entityId} (tenant: ${tenantId}) [job ${job.id}]`,
      );
      await this.embeddingService.deleteEmbedding(tenantId, entityType, entityId);
      this.logger.log(`Embedding deleted: ${entityType}/${entityId} [job ${job.id}]`);
      return;
    }

    // ── Upsert path ────────────────────────────────────────────────────────

    // Bail early without retrying if OPENAI_API_KEY is missing
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new UnrecoverableError(
        'OPENAI_API_KEY is not configured. AI embedding skipped.',
      );
    }

    if (!content?.trim()) {
      this.logger.warn(
        `Skipping empty content for ${entityType}/${entityId} (job ${job.id})`,
      );
      return;
    }

    this.logger.debug(
      `Generating embedding: ${entityType}/${entityId} (${content.length} chars) [job ${job.id}]`,
    );

    const embedding = await this.embeddingService.generateEmbedding(content);

    await this.embeddingService.upsertEmbedding({
      tenantId,
      entityType,
      entityId,
      content,
      embedding,
      metadata,
    });

    this.logger.log(
      `Embedding stored: ${entityType}/${entityId} (tenant: ${tenantId}) [job ${job.id}]`,
    );
  }
}
