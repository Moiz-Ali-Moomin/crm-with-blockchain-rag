import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { buildPaginatedResult, buildPrismaSkipTake } from '../../common/dto/pagination.dto';
import { FilterUsersDto } from './users.dto';

// Shared select projection — never expose sensitive fields in list/detail views
const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  jobTitle: true,
  phone: true,
  avatarUrl: true,
  timezone: true,
  invitedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: FilterUsersDto) {
    const { page, limit, sortBy, sortOrder, search, role, status } = filters;

    const where: Prisma.UserWhereInput = {
      ...(role && { role }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_PUBLIC_SELECT,
        orderBy: { [sortBy ?? 'createdAt']: sortOrder },
        ...buildPrismaSkipTake(page, limit),
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.user.findFirst({
      where: { id },
      select: {
        ...USER_PUBLIC_SELECT,
        tenant: {
          select: { id: true, name: true, plan: true },
        },
      },
    });
  }

  async findByIdWithHash(id: string) {
    return this.prisma.user.findFirst({
      where: { id },
      select: { id: true, passwordHash: true, tenantId: true, email: true, role: true },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email },
      select: { id: true, email: true, tenantId: true, status: true },
    });
  }

  async create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({
      data,
      select: USER_PUBLIC_SELECT,
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: USER_PUBLIC_SELECT,
    });
  }

  async updatePassword(id: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash },
      select: { id: true },
    });
  }
}
