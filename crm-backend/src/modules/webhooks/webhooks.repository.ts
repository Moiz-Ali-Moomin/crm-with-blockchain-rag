/**
 * Webhooks Repository
 *
 * Prisma queries only — no business logic.
 * tenantId is auto-injected via Prisma middleware from AsyncLocalStorage.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { buildPrismaSkipTake, buildPaginatedResult } from '../../common/dto/pagination.dto';

@Injectable()
export class WebhooksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page: number, limit: number) {
    const [data, total] = await Promise.all([
      this.prisma.webhookConfig.findMany({
        orderBy: { createdAt: 'desc' },
        ...buildPrismaSkipTake(page, limit),
      }),
      this.prisma.webhookConfig.count(),
    ]);
    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.webhookConfig.findFirst({
      where: { id },
      include: {
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async create(data: Prisma.WebhookConfigCreateInput) {
    return this.prisma.webhookConfig.create({ data });
  }

  async update(id: string, data: Prisma.WebhookConfigUpdateInput) {
    return this.prisma.webhookConfig.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.webhookConfig.delete({ where: { id } });
  }

  async getDeliveries(webhookId: string, page: number, limit: number) {
    const [data, total] = await Promise.all([
      this.prisma.webhookDelivery.findMany({
        where: { webhookId },
        orderBy: { createdAt: 'desc' },
        ...buildPrismaSkipTake(page, limit),
      }),
      this.prisma.webhookDelivery.count({ where: { webhookId } }),
    ]);
    return buildPaginatedResult(data, total, page, limit);
  }

  async findDeliveryById(deliveryId: string) {
    return this.prisma.webhookDelivery.findFirst({ where: { id: deliveryId } });
  }

  async createDelivery(data: Prisma.WebhookDeliveryCreateInput) {
    return this.prisma.webhookDelivery.create({ data });
  }

  async updateDelivery(id: string, data: Prisma.WebhookDeliveryUpdateInput) {
    return this.prisma.webhookDelivery.update({ where: { id }, data });
  }

  async incrementFailureCount(id: string) {
    return this.prisma.webhookConfig.update({
      where: { id },
      data: { failureCount: { increment: 1 } },
    });
  }

  async resetFailureCount(id: string) {
    return this.prisma.webhookConfig.update({
      where: { id },
      data: { failureCount: 0, lastTriggeredAt: new Date() },
    });
  }
}
