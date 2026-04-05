import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Prisma } from '@prisma/client';
import { buildPrismaSkipTake, buildPaginatedResult } from '../../common/dto/pagination.dto';

@Injectable()
export class ContactsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 20, search?: string, companyId?: string) {
    const where: Prisma.ContactWhereInput = {
      ...(companyId && { companyId }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        include: {
          company: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...buildPrismaSkipTake(page, limit),
      }),
      this.prisma.contact.count({ where }),
    ]);
    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.contact.findFirst({
      where: { id },
      include: {
        company: true,
        deals: { include: { stage: true }, orderBy: { createdAt: 'desc' } },
        tickets: { orderBy: { createdAt: 'desc' }, take: 5 },
        communications: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
  }

  async create(data: Prisma.ContactCreateInput) {
    return this.prisma.contact.create({ data });
  }

  async update(id: string, data: Prisma.ContactUpdateInput) {
    return this.prisma.contact.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.contact.delete({ where: { id } });
  }
}
