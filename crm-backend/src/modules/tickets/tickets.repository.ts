import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { buildPrismaSkipTake, buildPaginatedResult } from '../../common/dto/pagination.dto';
import { FilterTicketDto } from './tickets.dto';

@Injectable()
export class TicketsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: FilterTicketDto) {
    const { page, limit, sortBy, sortOrder, search, status, priority, assigneeId, contactId } = filters;

    const where: Prisma.TicketWhereInput = {
      ...(status && { status }),
      ...(priority && { priority }),
      ...(assigneeId && { assigneeId }),
      ...(contactId && { contactId }),
      ...(search && {
        subject: { contains: search, mode: 'insensitive' as const },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { [sortBy ?? 'createdAt']: sortOrder },
        ...buildPrismaSkipTake(page, limit),
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.ticket.findFirst({
      where: { id },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } },
        replies: {
          include: {
            author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async create(data: Prisma.TicketCreateInput) {
    return this.prisma.ticket.create({ data });
  }

  async update(id: string, data: Prisma.TicketUpdateInput) {
    return this.prisma.ticket.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.ticket.delete({ where: { id } });
  }

  async createReply(data: Prisma.TicketReplyCreateInput) {
    return this.prisma.ticketReply.create({
      data,
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
  }

  async findReplyById(replyId: string) {
    return this.prisma.ticketReply.findFirst({
      where: { id: replyId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async updateReply(replyId: string, data: Prisma.TicketReplyUpdateInput) {
    return this.prisma.ticketReply.update({ where: { id: replyId }, data });
  }

  async deleteReply(replyId: string) {
    return this.prisma.ticketReply.delete({ where: { id: replyId } });
  }
}
