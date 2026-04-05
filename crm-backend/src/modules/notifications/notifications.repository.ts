import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { buildPaginatedResult, buildPrismaSkipTake } from '../../common/dto/pagination.dto';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, page: number, limit: number, unreadOnly?: boolean) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(unreadOnly && { isRead: false }),
    };

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...buildPrismaSkipTake(page, limit),
      }),
      this.prisma.notification.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.notification.findFirst({ where: { id } });
  }

  async countUnread(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async create(data: Prisma.NotificationCreateInput) {
    return this.prisma.notification.create({ data });
  }

  async delete(id: string) {
    return this.prisma.notification.delete({ where: { id } });
  }
}
