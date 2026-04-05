import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { buildPrismaSkipTake, buildPaginatedResult } from '../../common/dto/pagination.dto';
import { FilterCommunicationDto } from './communications.dto';

@Injectable()
export class CommunicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: FilterCommunicationDto) {
    const { page, limit, sortBy, sortOrder, contactId, channel, direction, status, dateFrom, dateTo } = filters;

    const where: Prisma.CommunicationWhereInput = {
      ...(contactId && { contactId }),
      ...(channel && { channel }),
      ...(direction && { direction }),
      ...(status && { status }),
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.communication.findMany({
        where,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { [sortBy ?? 'createdAt']: sortOrder },
        ...buildPrismaSkipTake(page, limit),
      }),
      this.prisma.communication.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.communication.findFirst({
      where: { id },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });
  }

  async findByContact(contactId: string, page: number, limit: number) {
    const where: Prisma.CommunicationWhereInput = { contactId };

    const [data, total] = await Promise.all([
      this.prisma.communication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...buildPrismaSkipTake(page, limit),
      }),
      this.prisma.communication.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async create(data: Prisma.CommunicationCreateInput) {
    return this.prisma.communication.create({ data });
  }

  async updateStatus(id: string, status: string, externalId?: string, sentAt?: Date) {
    return this.prisma.communication.update({
      where: { id },
      data: {
        status: status as never,
        ...(externalId && { externalId }),
        ...(sentAt && { sentAt }),
      },
    });
  }

  async findTemplateById(templateId: string) {
    return this.prisma.emailTemplate.findFirst({
      where: { id: templateId, isActive: true },
    });
  }

  async delete(id: string) {
    return this.prisma.communication.delete({ where: { id } });
  }
}
