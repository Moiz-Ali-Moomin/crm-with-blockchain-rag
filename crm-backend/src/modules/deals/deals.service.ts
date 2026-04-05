/**
 * Deals Service
 *
 * Key features:
 * - Move deal between stages (triggers automation, records history)
 * - Kanban board data: deals grouped by stage
 * - Revenue forecasting: SUM(value * stage.probability) per pipeline
 * - Won/Lost handling with timestamps
 */

import { Injectable } from '@nestjs/common';
import { NotFoundError, BusinessRuleError } from '../../shared/errors/domain.errors';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DealsRepository } from './deals.repository';
import { PrismaTransactionService } from '../../core/database/prisma-transaction.service';
import { WsService, WS_EVENTS } from '../../core/websocket/ws.service';
import { QUEUE_NAMES, QUEUE_JOB_OPTIONS } from '../../core/queue/queue.constants';
import { PrismaService } from '../../core/database/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import {
  CreateDealDto,
  UpdateDealDto,
  FilterDealDto,
  MoveDealStageDto,
} from './deals.dto';

@Injectable()
export class DealsService {
  constructor(
    private readonly dealsRepo: DealsRepository,
    private readonly prisma: PrismaService,
    private readonly tx: PrismaTransactionService,
    private readonly ws: WsService,
    private readonly blockchainService: BlockchainService,
    @InjectQueue(QUEUE_NAMES.AUTOMATION) private readonly automationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATION) private readonly notificationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WEBHOOK_OUTBOUND) private readonly webhookQueue: Queue,
    @InjectQueue(QUEUE_NAMES.BLOCKCHAIN) private readonly blockchainQueue: Queue,
  ) {}

  async findAll(filters: FilterDealDto) {
    return this.dealsRepo.findAll(filters);
  }

  async findById(id: string) {
    const deal = await this.dealsRepo.findById(id);
    if (!deal) throw new NotFoundError('Deal', id);
    return deal;
  }

  /**
   * Get Kanban board data: deals grouped by pipeline stages
   * Used by the drag-and-drop Kanban UI
   */
  async getKanbanBoard(pipelineId: string) {
    const stages = await this.prisma.stage.findMany({
      where: { pipelineId },
      orderBy: { position: 'asc' },
    });

    const deals = await this.prisma.deal.findMany({
      where: { pipelineId, status: 'OPEN' },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        company: { select: { id: true, name: true } },
        owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group deals by stage
    const columns = stages.map((stage) => ({
      stage,
      deals: deals.filter((d) => d.stageId === stage.id),
      totalValue: deals
        .filter((d) => d.stageId === stage.id)
        .reduce((sum, d) => sum + Number(d.value), 0),
    }));

    return { pipelineId, columns };
  }

  /**
   * Revenue forecast: weighted sum by stage probability.
   * Uses _sum/_count aggregation — never loads individual deal rows into memory.
   */
  async getForecast(pipelineId: string) {
    const stages = await this.prisma.stage.findMany({
      where: { pipelineId },
      orderBy: { position: 'asc' },
    });

    const aggregates = await Promise.all(
      stages.map((s) =>
        this.prisma.deal.aggregate({
          where: { stageId: s.id, status: 'OPEN' },
          _count: { id: true },
          _sum:   { value: true },
        }),
      ),
    );

    let totalForecast = 0;
    let totalPipeline = 0;

    const breakdown = stages.map((stage, i) => {
      const agg         = aggregates[i];
      const stageTotal  = Number(agg._sum.value ?? 0);
      const dealCount   = agg._count.id;
      const stageForecast = stageTotal * stage.probability;
      totalForecast += stageForecast;
      totalPipeline += stageTotal;

      return {
        stage: stage.name,
        probability: stage.probability,
        totalValue: stageTotal,
        forecastedValue: stageForecast,
        dealCount,
      };
    });

    return { totalPipeline, totalForecast, breakdown };
  }

  async create(dto: CreateDealDto, ownerId: string, tenantId: string) {
    // Validate stage belongs to pipeline
    const stage = await this.prisma.stage.findFirst({
      where: { id: dto.stageId, pipelineId: dto.pipelineId },
    });

    if (!stage) {
      throw new BusinessRuleError('Stage does not belong to the specified pipeline');
    }

    const { pipelineId, stageId, contactId, companyId, customFields, ...dealData } = dto;
    const deal = await this.dealsRepo.create({
      ...dealData,
      customFields: customFields as any,
      tenant: { connect: { id: tenantId } },
      pipeline: { connect: { id: pipelineId } },
      stage: { connect: { id: stageId } },
      ...(ownerId && { owner: { connect: { id: ownerId } } }),
      ...(contactId && { contact: { connect: { id: contactId } } }),
      ...(companyId && { company: { connect: { id: companyId } } }),
    } as any);

    // Record initial stage history
    await this.prisma.dealStageHistory.create({
      data: {
        dealId: deal.id,
        tenantId,
        toStageId: dto.stageId,
        movedById: ownerId,
      },
    });

    await Promise.all([
      this.automationQueue.add(
        'evaluate',
        { tenantId, event: 'DEAL_CREATED', entityType: 'DEAL', entityId: deal.id, data: deal },
        QUEUE_JOB_OPTIONS.automation,
      ),
      this.webhookQueue.add(
        'deliver',
        { tenantId, event: 'DEAL_CREATED', payload: deal },
        QUEUE_JOB_OPTIONS.webhook,
      ),
    ]);

    this.ws.emitToTenant(tenantId, WS_EVENTS.DEAL_CREATED, { deal });

    return deal;
  }

  async update(id: string, dto: UpdateDealDto) {
    await this.findById(id);
    return this.dealsRepo.update(id, dto as any);
  }

  /**
   * Move a deal to a different stage (core Kanban operation)
   * Records history, triggers automation, handles Won/Lost logic
   */
  async moveStage(id: string, dto: MoveDealStageDto, actorId: string, tenantId: string) {
    const deal = await this.findById(id);
    const newStage = await this.prisma.stage.findFirst({
      where: { id: dto.stageId, pipelineId: deal.pipelineId },
    });

    if (!newStage) {
      throw new BusinessRuleError('Target stage not found in this pipeline');
    }

    const updates: Record<string, unknown> = {
      stageId: dto.stageId,
    };

    // Handle Won/Lost transitions
    if (newStage.isWon) {
      updates.status = 'WON';
      updates.wonAt = new Date();
    } else if (newStage.isLost) {
      updates.status = 'LOST';
      updates.lostAt = new Date();
      if (dto.lostReason) updates.lostReason = dto.lostReason;
    }

    const updatedDeal = await this.tx.run(async (tx) => {
      const updated = await tx.deal.update({
        where: { id },
        data: updates,
        include: {
          stage: true,
          contact: { select: { id: true, firstName: true, lastName: true } },
          owner: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      await tx.dealStageHistory.create({
        data: {
          dealId: id,
          tenantId,
          fromStageId: deal.stageId,
          toStageId: dto.stageId,
          movedById: actorId,
        },
      });

      return updated;
    });

    // Trigger automation engine
    const event = newStage.isWon ? 'DEAL_WON' : newStage.isLost ? 'DEAL_LOST' : 'DEAL_STAGE_CHANGED';

    await Promise.all([
      this.automationQueue.add(
        'evaluate',
        {
          tenantId,
          event,
          entityType: 'DEAL',
          entityId: id,
          data: { deal: updatedDeal, fromStageId: deal.stageId, toStageId: dto.stageId },
        },
        QUEUE_JOB_OPTIONS.automation,
      ),
      this.webhookQueue.add(
        'deliver',
        { tenantId, event: 'DEAL_UPDATED', payload: updatedDeal },
        QUEUE_JOB_OPTIONS.webhook,
      ),
    ]);

    const wsEvent = newStage.isWon
      ? WS_EVENTS.DEAL_WON
      : newStage.isLost
      ? WS_EVENTS.DEAL_LOST
      : WS_EVENTS.DEAL_STAGE_CHANGED;

    this.ws.emitToTenant(tenantId, wsEvent, { deal: updatedDeal });

    // Notify deal owner on Won/Lost
    if ((newStage.isWon || newStage.isLost) && updatedDeal.ownerId) {
      await this.notificationQueue.add('create', {
        tenantId,
        userId: updatedDeal.ownerId,
        title: `Deal ${newStage.isWon ? 'Won' : 'Lost'}!`,
        body: `${updatedDeal.title} has been marked as ${newStage.isWon ? 'Won' : 'Lost'}`,
        type: newStage.isWon ? 'deal_won' : 'deal_lost',
        entityType: 'DEAL',
        entityId: id,
      });
    }

    // ── Blockchain: register won deal hash on-chain (async, non-blocking) ──
    // Only for WON deals — this is the immutable contract trust layer.
    // The hash commits the deal's canonical fields at the moment of closing.
    if (newStage.isWon) {
      const payload = {
        tenantId,
        dealId: id,
        title: updatedDeal.title,
        value: updatedDeal.value.toString(),
        currency: updatedDeal.currency,
        wonAt: (updatedDeal.wonAt ?? new Date()).toISOString(),
        ownerId: updatedDeal.ownerId ?? null,
        pipelineId: updatedDeal.pipelineId,
      };

      const dataHash = this.blockchainService.computeDealHash(payload);

      await this.blockchainQueue.add(
        'register',
        {
          tenantId,
          entityType: 'DEAL',
          entityId: id,
          dataHash,
          payloadSnapshot: payload,
        },
        QUEUE_JOB_OPTIONS.blockchain,
      );
    }

    return updatedDeal;
  }

  async delete(id: string) {
    await this.findById(id);
    await this.dealsRepo.delete(id);
    return { deleted: true };
  }
}
