import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { buildPaginatedResult, buildPrismaSkipTake } from '../../common/dto/pagination.dto';
import { FilterTaskDto } from './tasks.dto';

@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: FilterTaskDto) {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      status,
      priority,
      assigneeId,
      entityType,
      entityId,
      dueFrom,
      dueTo,
    } = filters;

    const where: Prisma.TaskWhereInput = {
      ...(status && { status }),
      ...(priority && { priority }),
      ...(assigneeId && { assigneeId }),
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
      ...((dueFrom || dueTo) && {
        dueDate: {
          ...(dueFrom && { gte: new Date(dueFrom) }),
          ...(dueTo && { lte: new Date(dueTo) }),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          assignee: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { [sortBy ?? 'createdAt']: sortOrder },
        ...buildPrismaSkipTake(page, limit),
      }),
      this.prisma.task.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findById(id: string) {
    return this.prisma.task.findFirst({
      where: { id },
      include: {
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            jobTitle: true,
          },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async findMyTasks(assigneeId: string, page: number, limit: number) {
    const where: Prisma.TaskWhereInput = {
      assigneeId,
      status: { not: 'COMPLETED' },
    };

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          assignee: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
        ...buildPrismaSkipTake(page, limit),
      }),
      this.prisma.task.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async create(data: Prisma.TaskCreateInput) {
    return this.prisma.task.create({
      data,
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async update(id: string, data: Prisma.TaskUpdateInput) {
    return this.prisma.task.update({
      where: { id },
      data,
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async delete(id: string) {
    return this.prisma.task.delete({ where: { id } });
  }
}
