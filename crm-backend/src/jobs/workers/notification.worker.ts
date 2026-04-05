/**
 * Notification Worker
 * 1. Saves notification to DB
 * 2. Emits real-time event via WebSocket
 * 3. Updates unread count cache
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../../core/queue/queue.constants';
import { PrismaService } from '../../core/database/prisma.service';
import { WsService, WS_EVENTS } from '../../core/websocket/ws.service';
import { RedisService } from '../../core/cache/redis.service';
import { CACHE_KEYS } from '../../core/cache/cache-keys';

interface NotificationJobData {
  tenantId: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

@Processor(QUEUE_NAMES.NOTIFICATION)
export class NotificationWorker extends WorkerHost {
  private readonly logger = new Logger(NotificationWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ws: WsService,
    private readonly redis: RedisService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>) {
    const { tenantId, userId, title, body, type, entityType, entityId, metadata } = job.data;

    // Save to DB
    const notification = await this.prisma.withoutTenantScope(() =>
      this.prisma.notification.create({
        data: {
          tenantId,
          userId,
          title,
          body,
          type,
          entityType: entityType as any,
          entityId,
          metadata: (metadata ?? {}) as any,
        },
      }),
    );

    // Emit real-time notification via WebSocket
    this.ws.emitToUser(userId, WS_EVENTS.NOTIFICATION_NEW, {
      notification: {
        id: notification.id,
        title,
        body,
        type,
        entityType,
        entityId,
        createdAt: notification.createdAt,
      },
    });

    // Increment unread count cache
    const cacheKey = CACHE_KEYS.unreadNotifications(userId);
    const exists = await this.redis.exists(cacheKey);
    if (exists) {
      await this.redis.incr(cacheKey);
    }

    this.logger.debug(`Notification created for user ${userId}: ${title}`);
    return { notificationId: notification.id };
  }
}
