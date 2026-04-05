import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../shared/errors/domain.errors';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TasksRepository } from './tasks.repository';
import { WsService, WS_EVENTS } from '../../core/websocket/ws.service';
import { QUEUE_NAMES, QUEUE_JOB_OPTIONS } from '../../core/queue/queue.constants';
import { CreateTaskDto, UpdateTaskDto, FilterTaskDto, MyTasksQueryDto } from './tasks.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly tasksRepo: TasksRepository,
    private readonly ws: WsService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATION) private readonly notificationQueue: Queue,
  ) {}

  async findAll(filters: FilterTaskDto) {
    return this.tasksRepo.findAll(filters);
  }

  async findById(id: string) {
    const task = await this.tasksRepo.findById(id);
    if (!task) throw new NotFoundError('Task', id);
    return task;
  }

  async getMyTasks(userId: string, query: MyTasksQueryDto) {
    return this.tasksRepo.findMyTasks(userId, query.page, query.limit);
  }

  async create(dto: CreateTaskDto, createdById: string, tenantId: string) {
    const task = await this.tasksRepo.create({
      title: dto.title,
      ...(dto.description !== undefined && { description: dto.description }),
      status: dto.status,
      priority: dto.priority,
      ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
      ...(dto.reminderAt && { reminderAt: new Date(dto.reminderAt) }),
      ...(dto.entityType && { entityType: dto.entityType }),
      ...(dto.entityId && { entityId: dto.entityId }),
      tenant: { connect: { id: tenantId } },
      createdBy: { connect: { id: createdById } },
      ...(dto.assigneeId && { assignee: { connect: { id: dto.assigneeId } } }),
    });

    // If assigned to someone, queue notification and emit WS event
    if (dto.assigneeId) {
      await this.notificationQueue.add(
        'create',
        {
          tenantId,
          userId: dto.assigneeId,
          title: 'Task assigned',
          body: task.title,
          type: 'task_assigned',
          entityType: 'TASK',
          entityId: task.id,
        },
        QUEUE_JOB_OPTIONS.notification,
      );

      this.ws.emitToUser(dto.assigneeId, WS_EVENTS.TASK_ASSIGNED, { task });
    }

    // If a reminder is set, schedule a delayed notification job
    if (dto.reminderAt) {
      const reminderAt = new Date(dto.reminderAt);
      const delay = reminderAt.getTime() - Date.now();

      if (delay > 0) {
        await this.notificationQueue.add(
          'reminder',
          {
            tenantId,
            userId: dto.assigneeId ?? createdById,
            title: 'Task reminder',
            body: task.title,
            type: 'task_reminder',
            entityType: 'TASK',
            entityId: task.id,
          },
          {
            ...QUEUE_JOB_OPTIONS.notification,
            delay,
          },
        );
      }
    }

    return task;
  }

  async update(id: string, dto: UpdateTaskDto, actorId: string, tenantId: string) {
    const existing = await this.findById(id);

    const updated = await this.tasksRepo.update(id, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
      ...(dto.reminderAt !== undefined && {
        reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : null,
      }),
      ...(dto.entityType !== undefined && { entityType: dto.entityType }),
      ...(dto.entityId !== undefined && { entityId: dto.entityId }),
      ...(dto.assigneeId !== undefined && {
        assignee: dto.assigneeId ? { connect: { id: dto.assigneeId } } : { disconnect: true },
      }),
    });

    // Notify new assignee if assigneeId changed
    if (dto.assigneeId && dto.assigneeId !== existing.assigneeId) {
      await this.notificationQueue.add(
        'create',
        {
          tenantId,
          userId: dto.assigneeId,
          title: 'Task assigned',
          body: updated.title,
          type: 'task_assigned',
          entityType: 'TASK',
          entityId: id,
        },
        QUEUE_JOB_OPTIONS.notification,
      );

      this.ws.emitToUser(dto.assigneeId, WS_EVENTS.TASK_ASSIGNED, { task: updated });
    }

    return updated;
  }

  async complete(id: string, userId: string) {
    await this.findById(id);

    const task = await this.tasksRepo.update(id, {
      status: 'COMPLETED',
      completedAt: new Date(),
    });

    this.ws.emitToUser(userId, WS_EVENTS.TASK_COMPLETED, { task });

    return task;
  }

  async delete(id: string) {
    await this.findById(id);
    await this.tasksRepo.delete(id);
    return { deleted: true };
  }
}
