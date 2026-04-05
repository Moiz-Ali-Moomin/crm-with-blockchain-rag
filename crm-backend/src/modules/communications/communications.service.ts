/**
 * Communications Service
 *
 * Handles email and SMS sending through BullMQ queues.
 * Supports Handlebars template rendering for emails.
 * All external HTTP calls (SendGrid, Twilio) go through workers — never called directly here.
 */

import { Injectable, Logger } from '@nestjs/common';
import { NotFoundError, BusinessRuleError } from '../../shared/errors/domain.errors';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { renderTemplate } from '../../shared/utils/template.utils';
import { CommunicationsRepository } from './communications.repository';
import { QUEUE_NAMES, QUEUE_JOB_OPTIONS, embeddingJobOptions } from '../../core/queue/queue.constants';
import { SendEmailDto, SendSmsDto, FilterCommunicationDto } from './communications.dto';

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    private readonly commRepo: CommunicationsRepository,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SMS) private readonly smsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AI_EMBEDDING) private readonly embeddingQueue: Queue,
  ) {}

  async findAll(filters: FilterCommunicationDto) {
    return this.commRepo.findAll(filters);
  }

  async findById(id: string) {
    const comm = await this.commRepo.findById(id);
    if (!comm) throw new NotFoundError('Communication', id);
    return comm;
  }

  async getContactTimeline(contactId: string, page: number, limit: number) {
    return this.commRepo.findByContact(contactId, page, limit);
  }

  async delete(id: string, tenantId: string) {
    await this.findById(id); // 404 guard
    await this.commRepo.delete(id);

    // Purge orphaned embedding — fire-and-forget
    this.embeddingQueue
      .add(
        'delete-embed',
        { action: 'delete' as const, tenantId, entityType: 'communication', entityId: id },
        QUEUE_JOB_OPTIONS.aiEmbedding,
      )
      .catch((err: Error) =>
        this.logger.error(`Failed to enqueue embedding delete for communication ${id}: ${err.message}`),
      );

    return { deleted: true };
  }

  async sendEmail(dto: SendEmailDto, createdById: string, tenantId: string) {
    let subject = dto.subject;
    let renderedHtml: string | undefined;

    if (dto.templateId) {
      const emailTemplate = await this.commRepo.findTemplateById(dto.templateId);
      if (!emailTemplate) {
        throw new NotFoundError(`Email template ${dto.templateId} not found or inactive`);
      }

      subject = renderTemplate(emailTemplate.subject, dto.variables ?? {});
      renderedHtml = renderTemplate(emailTemplate.htmlBody, dto.variables ?? {});
    } else if (!dto.body) {
      throw new BusinessRuleError('Either templateId or body must be provided for email');
    }

    const comm = await this.commRepo.create({
      channel: 'EMAIL',
      direction: 'OUTBOUND',
      status: 'QUEUED',
      fromAddr: '',
      toAddr: dto.toAddr,
      subject,
      body: renderedHtml ?? dto.body ?? '',
      tenant: { connect: { id: tenantId } },
      ...(dto.templateId && { templateId: dto.templateId }),
      ...(dto.contactId && { contact: { connect: { id: dto.contactId } } }),
      ...(createdById && { sentById: createdById }),
    });

    await this.emailQueue.add(
      'send',
      {
        to: dto.toAddr,
        subject,
        html: renderedHtml ?? dto.body,
        communicationId: comm.id,
      },
      QUEUE_JOB_OPTIONS.email,
    );

    // Enqueue embedding — subject + body provide rich semantic signal for RAG
    const emailContent = [subject, renderedHtml ?? dto.body]
      .filter(Boolean)
      .join(' | ')
      .replace(/<[^>]+>/g, ' ') // strip HTML tags for clean embedding input
      .replace(/\s+/g, ' ')
      .trim();

    if (emailContent) {
      // Fire-and-forget — never block the request on Redis availability
      this.embeddingQueue
        .add(
          'embed',
          {
            action: 'upsert' as const,
            tenantId,
            entityType: 'communication',
            entityId: comm.id,
            content: emailContent,
            metadata: {
              channel: 'EMAIL',
              direction: 'OUTBOUND',
              contactId: dto.contactId,
              subject,
            },
          },
          embeddingJobOptions('communication', comm.id),
        )
        .catch((err: Error) =>
          this.logger.error(`Failed to enqueue embedding for email comm ${comm.id}: ${err.message}`),
        );
    }

    return comm;
  }

  async sendSms(dto: SendSmsDto, createdById: string, tenantId: string) {
    const comm = await this.commRepo.create({
      channel: 'SMS',
      direction: 'OUTBOUND',
      status: 'QUEUED',
      fromAddr: '',
      toAddr: dto.toAddr,
      body: dto.body,
      tenant: { connect: { id: tenantId } },
      ...(dto.contactId && { contact: { connect: { id: dto.contactId } } }),
      ...(createdById && { sentById: createdById }),
    });

    await this.smsQueue.add(
      'send',
      {
        to: dto.toAddr,
        body: dto.body,
        communicationId: comm.id,
      },
      QUEUE_JOB_OPTIONS.sms,
    );

    // Fire-and-forget — never block the request on Redis availability
    if (dto.body?.trim()) {
      this.embeddingQueue
        .add(
          'embed',
          {
            action: 'upsert' as const,
            tenantId,
            entityType: 'communication',
            entityId: comm.id,
            content: dto.body,
            metadata: {
              channel: 'SMS',
              direction: 'OUTBOUND',
              contactId: dto.contactId,
            },
          },
          embeddingJobOptions('communication', comm.id),
        )
        .catch((err: Error) =>
          this.logger.error(`Failed to enqueue embedding for SMS comm ${comm.id}: ${err.message}`),
        );
    }

    return comm;
  }
}
