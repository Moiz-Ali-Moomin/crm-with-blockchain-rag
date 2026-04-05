/**
 * Tickets Service
 *
 * Support ticket management with replies, assignment, and real-time WS events.
 * Notifications are enqueued via BullMQ — never sent directly.
 */

import { Injectable, Logger } from '@nestjs/common';
import { NotFoundError, ForbiddenError } from '../../shared/errors/domain.errors';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TicketsRepository } from './tickets.repository';
import { WsService, WS_EVENTS } from '../../core/websocket/ws.service';
import { QUEUE_NAMES, QUEUE_JOB_OPTIONS, embeddingJobOptions } from '../../core/queue/queue.constants';
import {
  CreateTicketDto,
  UpdateTicketDto,
  FilterTicketDto,
  CreateTicketReplyDto,
  UpdateTicketReplyDto,
  AssignTicketDto,
} from './tickets.dto';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly ticketsRepo: TicketsRepository,
    private readonly ws: WsService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATION) private readonly notificationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AI_EMBEDDING) private readonly embeddingQueue: Queue,
  ) {}

  async findAll(filters: FilterTicketDto) {
    return this.ticketsRepo.findAll(filters);
  }

  async findById(id: string) {
    const ticket = await this.ticketsRepo.findById(id);
    if (!ticket) throw new NotFoundError('Ticket', id);
    return ticket;
  }

  async create(dto: CreateTicketDto, createdById: string, tenantId: string) {
    const ticket = await this.ticketsRepo.create({
      subject: dto.subject,
      description: dto.description,
      status: dto.status,
      priority: dto.priority,
      createdBy: { connect: { id: createdById } },
      tenant: { connect: { id: tenantId } },
      ...(dto.contactId && { contact: { connect: { id: dto.contactId } } }),
      ...(dto.assigneeId && { assignee: { connect: { id: dto.assigneeId } } }),
    });

    // Notify assignee if one was set on creation
    if (dto.assigneeId) {
      await this.notificationQueue.add(
        'create',
        {
          tenantId,
          userId: dto.assigneeId,
          title: 'New ticket assigned to you',
          body: `Ticket: ${dto.subject}`,
          type: 'ticket_assigned',
          entityType: 'TICKET',
          entityId: ticket.id,
        },
        QUEUE_JOB_OPTIONS.notification,
      );

      this.ws.emitToUser(dto.assigneeId, WS_EVENTS.TICKET_ASSIGNED, { ticket });
    }

    this.ws.emitToTenant(tenantId, WS_EVENTS.TICKET_CREATED, { ticket });

    // Enqueue embedding — subject + description are the primary semantic signals
    const ticketContent = [
      `Subject: ${dto.subject}`,
      dto.description,
      `Priority: ${dto.priority ?? 'MEDIUM'}`,
    ]
      .filter(Boolean)
      .join(' | ');

    // Fire-and-forget — never block the request on Redis availability
    this.embeddingQueue
      .add(
        'embed',
        {
          action: 'upsert' as const,
          tenantId,
          entityType: 'ticket',
          entityId: ticket.id,
          content: ticketContent,
          metadata: {
            subject: dto.subject,
            priority: dto.priority,
            contactId: dto.contactId,
            assigneeId: dto.assigneeId,
          },
        },
        embeddingJobOptions('ticket', ticket.id),
      )
      .catch((err: Error) =>
        this.logger.error(`Failed to enqueue embedding for ticket ${ticket.id}: ${err.message}`),
      );

    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto) {
    const ticket = await this.findById(id);

    const updates: Record<string, unknown> = { ...dto };

    // Auto-set resolvedAt when transitioning to RESOLVED
    if (dto.status === 'RESOLVED' && ticket.status !== 'RESOLVED') {
      updates.resolvedAt = new Date();
    }

    const updated = await this.ticketsRepo.update(id, updates);

    this.ws.emitToTenant(ticket.tenantId, WS_EVENTS.TICKET_UPDATED, { ticket: updated });

    // Re-index if subject or description changed
    if (dto.subject !== undefined || dto.description !== undefined) {
      const content = [
        `Subject: ${updated.subject}`,
        updated.description,
        `Priority: ${updated.priority ?? 'MEDIUM'}`,
      ]
        .filter(Boolean)
        .join(' | ');

      this.embeddingQueue
        .add(
          'embed',
          {
            action: 'upsert' as const,
            tenantId: ticket.tenantId,
            entityType: 'ticket',
            entityId: id,
            content,
            metadata: { subject: updated.subject, priority: updated.priority },
          },
          embeddingJobOptions('ticket', id),
        )
        .catch((err: Error) =>
          this.logger.error(`Failed to re-index embedding for ticket ${id}: ${err.message}`),
        );
    }

    return updated;
  }

  async delete(id: string) {
    const existing = await this.findById(id);
    await this.ticketsRepo.delete(id);

    // Purge orphaned embedding — fire-and-forget
    this.embeddingQueue
      .add(
        'delete-embed',
        { action: 'delete' as const, tenantId: existing.tenantId, entityType: 'ticket', entityId: id },
        QUEUE_JOB_OPTIONS.aiEmbedding,
      )
      .catch((err: Error) =>
        this.logger.error(`Failed to enqueue embedding delete for ticket ${id}: ${err.message}`),
      );

    return { deleted: true };
  }

  async assign(id: string, dto: AssignTicketDto, tenantId: string) {
    const ticket = await this.findById(id);

    const updated = await this.ticketsRepo.update(id, {
      assignee: { connect: { id: dto.assigneeId } },
    });

    await this.notificationQueue.add(
      'create',
      {
        tenantId,
        userId: dto.assigneeId,
        title: 'Ticket assigned to you',
        body: `Ticket: ${ticket.subject}`,
        type: 'ticket_assigned',
        entityType: 'TICKET',
        entityId: id,
      },
      QUEUE_JOB_OPTIONS.notification,
    );

    this.ws.emitToUser(dto.assigneeId, WS_EVENTS.TICKET_ASSIGNED, { ticket: updated });
    this.ws.emitToTenant(tenantId, WS_EVENTS.TICKET_UPDATED, { ticket: updated });

    return updated;
  }

  async addReply(
    ticketId: string,
    dto: CreateTicketReplyDto,
    authorId: string,
    tenantId: string,
  ) {
    const ticket = await this.findById(ticketId);

    const reply = await this.ticketsRepo.createReply({
      body: dto.body,
      isInternal: dto.isInternal,
      authorId,
      tenantId,
      ticket: { connect: { id: ticketId } },
    } as any);

    // Emit real-time event to the assignee if there is one
    if (ticket.assigneeId && ticket.assigneeId !== authorId) {
      this.ws.emitToUser(ticket.assigneeId, WS_EVENTS.TICKET_REPLY, {
        ticketId,
        reply,
      });
    }

    // Also broadcast to the ticket room in case other agents are watching
    this.ws.emitToTenant(tenantId, WS_EVENTS.TICKET_REPLY, { ticketId, reply });

    return reply;
  }

  async updateReply(replyId: string, dto: UpdateTicketReplyDto, authorId: string) {
    const reply = await this.ticketsRepo.findReplyById(replyId);
    if (!reply) throw new NotFoundError('Reply', replyId);

    if (reply.authorId !== authorId) {
      throw new ForbiddenError('Only the author can update this reply');
    }

    return this.ticketsRepo.updateReply(replyId, { body: dto.body });
  }

  async deleteReply(replyId: string, authorId: string, userRole: string) {
    const reply = await this.ticketsRepo.findReplyById(replyId);
    if (!reply) throw new NotFoundError('Reply', replyId);

    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    if (reply.authorId !== authorId && !isAdmin) {
      throw new ForbiddenError('Only the author or an admin can delete this reply');
    }

    await this.ticketsRepo.deleteReply(replyId);
    return { deleted: true };
  }
}
