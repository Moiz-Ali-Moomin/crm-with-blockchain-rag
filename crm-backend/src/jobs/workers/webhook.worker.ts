/**
 * Webhook Worker - Outbound webhook delivery with retry logic
 *
 * Delivers events to tenant-configured webhook URLs.
 * Signs payloads with HMAC-SHA256 using the webhook's secret.
 * Updates delivery record on success/failure.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { QUEUE_NAMES } from '../../core/queue/queue.constants';
import { PrismaService } from '../../core/database/prisma.service';

interface WebhookJobData {
  tenantId: string;
  event: string;
  payload: Record<string, unknown>;
}

@Processor(QUEUE_NAMES.WEBHOOK_OUTBOUND)
export class WebhookWorker extends WorkerHost {
  private readonly logger = new Logger(WebhookWorker.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<WebhookJobData>) {
    const { tenantId, event, payload } = job.data;

    // Find all active webhooks for this tenant that subscribe to this event
    const webhooks = await this.prisma.withoutTenantScope(() =>
      this.prisma.webhookConfig.findMany({
        where: {
          tenantId,
          isActive: true,
          events: { has: event as any },
        },
      }),
    );

    if (webhooks.length === 0) return { delivered: 0 };

    const deliveryPromises = webhooks.map((webhook) =>
      this.deliverWebhook(webhook, event, payload, tenantId, job.attemptsMade + 1),
    );

    await Promise.allSettled(deliveryPromises);
    return { delivered: webhooks.length };
  }

  private async deliverWebhook(
    webhook: { id: string; url: string; secret: string },
    event: string,
    payload: Record<string, unknown>,
    tenantId: string,
    attempt: number,
  ): Promise<void> {
    const body = JSON.stringify({
      event,
      payload,
      timestamp: new Date().toISOString(),
    });

    // HMAC-SHA256 signature for webhook verification
    const signature = createHmac('sha256', webhook.secret)
      .update(body)
      .digest('hex');

    let statusCode: number | undefined;
    let responseBody: string | undefined;
    let success = false;

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-Signature': `sha256=${signature}`,
          'X-CRM-Event': event,
          'X-CRM-Delivery': webhook.id,
        },
        body,
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      statusCode = response.status;
      responseBody = await response.text().catch(() => '');
      success = response.ok; // 2xx status codes

      if (!success) {
        this.logger.warn(
          `Webhook delivery failed for ${webhook.url}: ${statusCode}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Webhook delivery error for ${webhook.url}: ${(error as Error).message}`,
      );
    }

    // Record delivery attempt
    await this.prisma.withoutTenantScope(() =>
      this.prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          tenantId,
          event: event as any,
          payload: payload as any,
          statusCode,
          responseBody,
          attempt,
          success,
        },
      }),
    );

    // Update failure count on webhook config
    if (!success) {
      await this.prisma.withoutTenantScope(() =>
        this.prisma.webhookConfig.update({
          where: { id: webhook.id },
          data: { failureCount: { increment: 1 } },
        }),
      );
      throw new Error(`Webhook delivery failed with status ${statusCode}`);
    }

    // Reset failure count on success
    await this.prisma.withoutTenantScope(() =>
      this.prisma.webhookConfig.update({
        where: { id: webhook.id },
        data: { failureCount: 0, lastTriggeredAt: new Date() },
      }),
    );
  }
}
