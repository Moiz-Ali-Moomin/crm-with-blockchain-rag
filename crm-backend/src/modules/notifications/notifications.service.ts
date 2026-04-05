import { Injectable } from '@nestjs/common';
import { NotFoundError, ForbiddenError } from '../../shared/errors/domain.errors';
import { NotificationsRepository } from './notifications.repository';
import { WsService, WS_EVENTS } from '../../core/websocket/ws.service';
import { RedisService } from '../../core/cache/redis.service';
import { CACHE_KEYS } from '../../core/cache/cache-keys';
import { CreateNotificationDto, ListNotificationsQueryDto } from './notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepo: NotificationsRepository,
    private readonly ws: WsService,
    private readonly redis: RedisService,
  ) {}

  async findAll(userId: string, query: ListNotificationsQueryDto) {
    return this.notificationsRepo.findAll(userId, query.page, query.limit, query.unreadOnly);
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const cacheKey = CACHE_KEYS.unreadNotifications(userId);

    const cached = await this.redis.get<number>(cacheKey);
    if (cached !== null) {
      return { count: cached };
    }

    const count = await this.notificationsRepo.countUnread(userId);

    // Cache for 5 minutes; the notification worker increments this on new notifications
    await this.redis.set(cacheKey, count, 300);

    return { count };
  }

  async markRead(id: string, userId: string) {
    const notification = await this.notificationsRepo.findById(id);

    if (!notification) {
      throw new NotFoundError('Notification', id);
    }

    if (notification.userId !== userId) {
      throw new ForbiddenError("Cannot mark another user's notification as read");
    }

    if (notification.isRead) {
      return notification;
    }

    const updated = await this.notificationsRepo.markRead(id);

    // Decrement cache counter safely (don't go below 0)
    const cacheKey = CACHE_KEYS.unreadNotifications(userId);
    const cached = await this.redis.get<number>(cacheKey);
    if (cached !== null && cached > 0) {
      await this.redis.incrby(cacheKey, -1);
    }

    this.ws.emitToUser(userId, WS_EVENTS.NOTIFICATION_READ, { notificationId: id });

    return updated;
  }

  async markAllRead(userId: string) {
    const result = await this.notificationsRepo.markAllRead(userId);

    // Reset unread count cache to 0
    await this.redis.set(CACHE_KEYS.unreadNotifications(userId), 0, 300);

    this.ws.emitToUser(userId, WS_EVENTS.NOTIFICATION_READ, { all: true });

    return { updated: result.count };
  }

  /**
   * Internal method used by NotificationWorker — no HTTP route.
   * Creates a notification directly in the DB and emits WS event.
   */
  async create(dto: CreateNotificationDto) {
    const notification = await this.notificationsRepo.create({
      tenant: { connect: { id: dto.tenantId } },
      user: { connect: { id: dto.userId } },
      title: dto.title,
      body: dto.body,
      type: dto.type,
      ...(dto.entityType && { entityType: dto.entityType as any }),
      ...(dto.entityId && { entityId: dto.entityId }),
    });

    this.ws.emitToUser(dto.userId, WS_EVENTS.NOTIFICATION_NEW, {
      notification: {
        id: notification.id,
        title: notification.title,
        body: notification.body,
        type: notification.type,
        entityType: notification.entityType,
        entityId: notification.entityId,
        createdAt: notification.createdAt,
      },
    });

    // Increment unread count cache if it exists
    const cacheKey = CACHE_KEYS.unreadNotifications(dto.userId);
    const exists = await this.redis.exists(cacheKey);
    if (exists) {
      await this.redis.incr(cacheKey);
    }

    return notification;
  }

  async delete(id: string, userId: string) {
    const notification = await this.notificationsRepo.findById(id);

    if (!notification) {
      throw new NotFoundError('Notification', id);
    }

    if (notification.userId !== userId) {
      throw new ForbiddenError("Cannot delete another user's notification");
    }

    // Decrement cache if the notification was unread
    if (!notification.isRead) {
      const cacheKey = CACHE_KEYS.unreadNotifications(userId);
      const cached = await this.redis.get<number>(cacheKey);
      if (cached !== null && cached > 0) {
        await this.redis.incrby(cacheKey, -1);
      }
    }

    await this.notificationsRepo.delete(id);
    return { deleted: true };
  }
}
