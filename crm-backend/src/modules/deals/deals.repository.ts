import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { buildPrismaSkipTake, buildPaginatedResult } from '../../common/dto/pagination.dto';
import { FilterDealDto } from './deals.dto';

@Injectable()
export class DealsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: FilterDealDto) {
    const { page, limit, sortBy, sortOrder, search, pipelineId, stageId, status, ownerId, contactId, minValue, maxValue } = filters;

    const where: Prisma.DealWhereInput = {
      ...(pipelineId && { pipelineId }),
      ...(stageId && { stageId }),
      ...(status && { status }),
      ...(ownerId && { ownerId }),
      ...(contactId && { contactId }),
      ...(minValue !== undefined && { value: { gte: minValue } }),
      ...(maxValue !== undefined && { value: { lte: maxValue } }),
      ...(search && {
        title: { contains: search, mode: 'insensitive' as const },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        include: {
          stage: true,
          pipeline: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          company: { select: { id: true, name: true } },
          owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { [sortBy ?? 'createdAt']: sortOrder },
        ...buildPrismaSkipTake(page, limit),
      }),
      this.prisma.deal.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.deal.findFirst({
      where: { id },
      include: {
        stage: true,
        pipeline: true,
        contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        company: { select: { id: true, name: true } },
        owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        stageHistory: {
          include: { toStage: { select: { name: true, color: true } } },
          orderBy: { movedAt: 'desc' },
        },
      },
    });
  }

  async create(data: Prisma.DealCreateInput) {
    return this.prisma.deal.create({ data });
  }

  async update(id: string, data: Prisma.DealUpdateInput) {
    return this.prisma.deal.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.deal.delete({ where: { id } });
  }
}
