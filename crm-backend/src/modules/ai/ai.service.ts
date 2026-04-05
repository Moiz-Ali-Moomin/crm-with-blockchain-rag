/**
 * AiService — thin orchestration layer
 *
 * All controller endpoints go through this service.
 * It delegates to VectorSearchService, CopilotService, RagService,
 * and BlockchainService (for the combined RAG + blockchain deal verification flow).
 */

import { Injectable } from '@nestjs/common';
import { VectorSearchService } from './vector-search.service';
import { CopilotService } from './copilot.service';
import { RagService } from './rag.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { PrismaService } from '../../core/database/prisma.service';
import {
  SemanticSearchDto,
  SummarizeContactDto,
  GenerateEmailReplyDto,
  SuggestFollowUpDto,
  SummarizeActivityDto,
  RagQueryDto,
  VerifyDealWithAiDto,
} from './ai.dto';

@Injectable()
export class AiService {
  constructor(
    private readonly vectorSearch: VectorSearchService,
    private readonly copilot: CopilotService,
    private readonly rag: RagService,
    private readonly blockchain: BlockchainService,
    private readonly prisma: PrismaService,
  ) {}

  semanticSearch(tenantId: string, dto: SemanticSearchDto) {
    return this.vectorSearch.search({
      tenantId,
      query: dto.query,
      entityTypes: dto.entityTypes,
      limit: dto.limit,
      threshold: dto.threshold,
    });
  }

  summarizeContact(tenantId: string, dto: SummarizeContactDto) {
    return this.copilot.summarizeContactHistory(
      tenantId,
      dto.contactId,
      dto.contextLimit,
    );
  }

  generateEmailReply(tenantId: string, dto: GenerateEmailReplyDto) {
    return this.copilot.generateEmailReply(
      tenantId,
      dto.communicationId,
      dto.instruction,
    );
  }

  suggestFollowUp(tenantId: string, dto: SuggestFollowUpDto) {
    return this.copilot.suggestFollowUp(tenantId, dto.entityType, dto.entityId);
  }

  summarizeActivity(tenantId: string, dto: SummarizeActivityDto) {
    return this.copilot.summarizeActivityTimeline(
      tenantId,
      dto.entityType,
      dto.entityId,
      dto.contextLimit,
    );
  }

  /**
   * POST /ai/query — Full RAG pipeline endpoint.
   * Embeds the natural language query, retrieves semantically similar CRM
   * records (activities, comms, tickets), builds a context window, and asks
   * GPT-4o to answer using only the retrieved facts.
   */
  ragQuery(tenantId: string, dto: RagQueryDto) {
    return this.rag.query({
      tenantId,
      query: dto.query,
      entityTypes: dto.entityTypes,
      topK: dto.topK,
      threshold: dto.threshold,
    });
  }

  /**
   * POST /ai/deals/verify — Combined RAG + Blockchain deal verification.
   *
   * Flow:
   *   1. Fetch deal metadata from PostgreSQL
   *   2. Check on-chain verification status (BlockchainService — read-only, no gas)
   *   3. Run RAG query scoped to deal-related records (activities, comms, tickets)
   *   4. Inject blockchain status into the RAG context so GPT-4o can answer
   *      questions like "Is this deal verified?" with full factual grounding
   *
   * Returns: RAG answer + blockchain proof record + deal snapshot
   */
  async verifyDealWithAi(
    tenantId: string,
    dto: VerifyDealWithAiDto,
  ): Promise<{
    answer: string;
    blockchainStatus: {
      isVerified: boolean;
      txHash: string | null;
      blockNumber: number | null;
      registeredAt: Date | null;
      network: string;
    };
    dealSnapshot: {
      id: string;
      title: string;
      value: string;
      status: string;
      closingDate: Date | null;
    } | null;
    sources: { entityType: string; entityId: string; similarity: number; excerpt: string }[];
    confidence: number;
    fromCache: boolean;
  }> {
    // ── Steps 1+2 in parallel: DB fetch and chain read are independent ─────
    const [deal, chainResult] = await Promise.all([
      this.prisma.withoutTenantScope(() =>
        this.prisma.deal.findFirst({
          where: { id: dto.dealId, tenantId },
          select: {
            id: true,
            title: true,
            value: true,
            status: true,
            closingDate: true,
            wonAt: true,
            currency: true,
            contact: { select: { firstName: true, lastName: true } },
            owner: { select: { firstName: true, lastName: true } },
            stage: { select: { name: true } },
          },
        }),
      ),
      this.blockchain.verifyDealOnChain(tenantId, dto.dealId),
    ]);

    // ── Step 3: Build verification-aware RAG query (uses results from Step 1+2) ──
    // Inject blockchain status as grounding context so the LLM has factual
    // information about verification — prevents hallucination on trust status.
    const chainStatusText = chainResult.isValid
      ? `BLOCKCHAIN VERIFICATION: CONFIRMED ✓ — Transaction ${chainResult.txHash} on ${chainResult.network} ` +
        `(block ${chainResult.blockNumber}, registered ${chainResult.registeredAt?.toISOString() ?? 'unknown'})`
      : deal?.status === 'WON'
      ? `BLOCKCHAIN VERIFICATION: PENDING — Deal was won but on-chain hash is not yet confirmed.`
      : `BLOCKCHAIN VERIFICATION: NOT APPLICABLE — Deal has not been won yet (status: ${deal?.status ?? 'unknown'}).`;

    const dealContextText = deal
      ? `Deal: "${deal.title}" | Value: ${deal.currency} ${deal.value} | Status: ${deal.status} | ` +
        `Stage: ${deal.stage?.name ?? 'N/A'} | Contact: ${deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName}` : 'N/A'} | ` +
        `Owner: ${deal.owner ? `${deal.owner.firstName} ${deal.owner.lastName}` : 'N/A'}`
      : 'Deal not found.';

    const additionalContext = dto.additionalContext ? `\n\nUser question context: ${dto.additionalContext}` : '';

    const enrichedQuery =
      `${chainStatusText}\n\n${dealContextText}${additionalContext}\n\n` +
      `Question: Is this deal verified on the blockchain, and what is the current status of this deal?`;

    // ── Step 4: RAG retrieval + LLM generation ─────────────────────────────
    const ragResult = await this.rag.query({
      tenantId,
      query: enrichedQuery,
      entityTypes: ['activity', 'communication', 'ticket'],
      topK: 6,
      threshold: 0.65, // Slightly lower threshold — deal context may be sparse
    });

    return {
      answer: ragResult.answer,
      blockchainStatus: {
        isVerified: chainResult.isValid,
        txHash: chainResult.txHash,
        blockNumber: chainResult.blockNumber,
        registeredAt: chainResult.registeredAt,
        network: chainResult.network,
      },
      dealSnapshot: deal
        ? {
            id: deal.id,
            title: deal.title,
            value: deal.value.toString(),
            status: deal.status,
            closingDate: deal.closingDate,
          }
        : null,
      sources: ragResult.sources,
      confidence: ragResult.confidence,
      fromCache: ragResult.fromCache,
    };
  }
}
