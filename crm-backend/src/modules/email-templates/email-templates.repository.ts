import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { buildPrismaSkipTake, buildPaginatedResult } from '../../common/dto/pagination.dto';
import { FilterEmailTemplateDto } from './email-templates.dto';

@Injectable()
export class EmailTemplatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: FilterEmailTemplateDto) {
    const { page, limit, sortBy, sortOrder, search, isActive, category } = filters;

    const where: Prisma.EmailTemplateWhereInput = {
      ...(isActive !== undefined && { isActive }),
      ...(category && { category }),
      ...(search && {
        name: { contains: search, mode: 'insensitive' as const },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.emailTemplate.findMany({
        where,
        // Exclude htmlBody from list for performance — only include in findById
        select: {
          id: true,
          name: true,
          subject: true,
          variables: true,
          isActive: true,
          category: true,
          createdAt: true,
          tenantId: true,
          createdById: true,
          updatedAt: true,
          plainText: false,
          htmlBody: false,
        },
        orderBy: { [sortBy ?? 'createdAt']: sortOrder },
        ...buildPrismaSkipTake(page, limit),
      }),
      this.prisma.emailTemplate.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.emailTemplate.findFirst({
      where: { id },
    });
  }

  async create(data: Prisma.EmailTemplateCreateInput) {
    return this.prisma.emailTemplate.create({ data });
  }

  async update(id: string, data: Prisma.EmailTemplateUpdateInput) {
    return this.prisma.emailTemplate.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.emailTemplate.delete({ where: { id } });
  }
}
