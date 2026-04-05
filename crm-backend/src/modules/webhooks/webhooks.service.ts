/**
 * Webhooks Service
 *
 * Business logic for webhook configuration management, delivery tracking,
 * and HMAC-signed test deliveries via BullMQ.
 */

import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WebhooksRepository } from './webhooks.repository';
import { QUEUE_NAMES, QUEUE_JOB_OPTIONS } from '../../core/queue/queue.constants';
import { CreateWebhookDto, UpdateWebhookDto } from './webhooks.dto';
import { NotFoundError, BusinessRuleError } from '../../shared/errors/domain.errors';
import { randomToken, hmacSha256 } from '../../shared/utils/crypto.utils';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly webhooksRepo: WebhooksRepository,
    @InjectQueue(QUEUE_NAMES.WEBHOOK_OUTBOUND) private readonly webhookQueue: Queue,
  ) {}

  async findAll(page: number, limit: number) {
    return this.webhooksRepo.findAll(page, limit);
  }

  async findById(id: string) {
    const config = await this.webhooksRepo.findById(id);
    if (!config) throw new NotFoundError('Webhook config', id);
    return config;
  }

  async create(dto: CreateWebhookDto, tenantId: string) {
    const secret = dto.secret ?? randomToken(32);
    return this.webhooksRepo.create({
      url: dto.url,
      secret,
      events: dto.events as any,
      isActive: dto.isActive,
      tenant: { connect: { id: tenantId } },
    });
  }

  async update(id: string, dto: UpdateWebhookDto) {
    await this.findById(id);
    return this.webhooksRepo.update(id, {
      ...(dto.url !== undefined && { url: dto.url }),
      ...(dto.secret !== undefined && { secret: dto.secret }),
      ...(dto.events !== undefined && { events: dto.events as any }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await this.webhooksRepo.delete(id);
    return { message: 'Webhook configuration deleted' };
  }

  async testWebhook(id: string) {
    const config = await this.findById(id);
    if (!config.isActive) {
      throw new BusinessRuleError('Cannot test an inactive webhook');
    }

    const payload = { test: true, timestamp: new Date() };
    const signature = `sha256=${hmacSha256(config.secret, JSON.stringify(payload))}`;

    await this.webhookQueue.add(
      'deliver',
      { webhookConfigId: id, event: 'TEST', payload },
      QUEUE_JOB_OPTIONS.webhook,
    );

    return {
      message: 'Test webhook delivery queued',
      signature,
      payload,
    };
  }

  async getDeliveries(webhookId: string, page: number, limit: number) {
    await this.findById(webhookId);
    return this.webhooksRepo.getDeliveries(webhookId, page, limit);
  }

  async retryDelivery(deliveryId: string) {
    const delivery = await this.webhooksRepo.findDeliveryById(deliveryId);
    if (!delivery) throw new NotFoundError('Delivery', deliveryId);

    if (delivery.success) {
      throw new BusinessRuleError('Cannot retry a successful delivery');
    }

    const config = await this.webhooksRepo.findById(delivery.webhookId);
    if (!config) throw new NotFoundError('Webhook config for delivery');

    await this.webhookQueue.add(
      'deliver',
      {
        webhookConfigId: delivery.webhookId,
        event: delivery.event,
        payload: delivery.payload,
        deliveryId: delivery.id,
      },
      QUEUE_JOB_OPTIONS.webhook,
    );

    return { message: 'Delivery retry queued', deliveryId };
  }
}
