/**
 * Companies Repository
 *
 * Note: tenantId is NOT passed to Prisma here — it is injected automatically
 * by the PrismaService middleware from AsyncLocalStorage.
 * All queries are automatically tenant-scoped.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { buildPrismaSkipTake, buildPaginatedResult } from '../../common/dto/pagination.dto';
import { FilterCompanyDto } from './companies.dto';

@Injectable()
export class CompaniesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: FilterCompanyDto) {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      search,
      industry,
      city,
      country,
      ownerId,
      minEmployeeCount,
      maxEmployeeCount,
      tags,
    } = filters;

    const where: Prisma.CompanyWhereInput = {
      ...(industry && { industry: { contains: industry, mode: 'insensitive' } }),
      ...(city && { city: { contains: city, mode: 'insensitive' } }),
      ...(country && { country: { contains: country, mode: 'insensitive' } }),
      ...(ownerId && { ownerId }),
      ...(minEmployeeCount !== undefined && {
        employeeCount: { gte: minEmployeeCount },
      }),
      ...(maxEmployeeCount !== undefined && {
        employeeCount: {
          ...(minEmployeeCount !== undefined ? { gte: minEmployeeCount } : {}),
          lte: maxEmployeeCount,
        },
      }),
      ...(tags && { tags: { hasSome: tags.split(',').map((t) => t.trim()) } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { industry: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
          { country: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { [sortBy ?? 'createdAt']: sortOrder },
        ...buildPrismaSkipTake(page, limit),
      }),
      this.prisma.company.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.company.findFirst({
      where: { id },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        contacts: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            jobTitle: true,
            createdAt: true,
          },
        },
        deals: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            stage: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });
  }

  async create(data: Prisma.CompanyCreateInput) {
    return this.prisma.company.create({
      data,
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async update(id: string, data: Prisma.CompanyUpdateInput) {
    return this.prisma.company.update({
      where: { id },
      data,
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async delete(id: string) {
    return this.prisma.company.delete({ where: { id } });
  }
}
