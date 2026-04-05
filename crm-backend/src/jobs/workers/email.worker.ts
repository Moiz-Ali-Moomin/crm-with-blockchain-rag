/**
 * Email Worker - Processes the BullMQ 'email' queue
 *
 * Handles:
 * - Template-based emails (renders Handlebars template with variables)
 * - Direct emails (subject + body provided)
 * - Updates communication record status after delivery
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import Handlebars from 'handlebars';
import { QUEUE_NAMES } from '../../core/queue/queue.constants';
import { PrismaService } from '../../core/database/prisma.service';

interface EmailJobData {
  tenantId: string;
  communicationId?: string;  // Update status after sending
  to: string;
  from?: string;
  subject?: string;
  htmlBody?: string;
  plainText?: string;
  templateId?: string;       // Our DB template ID
  templateVars?: Record<string, unknown>;
}

@Processor(QUEUE_NAMES.EMAIL)
export class EmailWorker extends WorkerHost {
  private readonly logger = new Logger(EmailWorker.name);
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super();

    const apiKey = this.config.get<string>('SENDGRID_API_KEY');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
    }

    this.fromEmail = this.config.get<string>('SENDGRID_FROM_EMAIL', 'noreply@crm.app');
    this.fromName = this.config.get<string>('SENDGRID_FROM_NAME', 'CRM Platform');
  }

  async process(job: Job<EmailJobData>) {
    const { tenantId, communicationId, to, from, subject, htmlBody, plainText, templateId, templateVars } = job.data;

    this.logger.debug(`Processing email job ${job.id} to ${to}`);

    let renderedHtml = htmlBody;
    let renderedSubject = subject;

    // Fetch and render DB template if templateId provided
    if (templateId) {
      const template = await this.prisma.withoutTenantScope(() =>
        this.prisma.emailTemplate.findFirst({ where: { id: templateId, tenantId } }),
      );

      if (!template) {
        // Template not found - this is a configuration error, don't retry
        throw new UnrecoverableError(`Email template ${templateId} not found`);
      }

      renderedHtml = Handlebars.compile(template.htmlBody)(templateVars ?? {});
      renderedSubject = Handlebars.compile(template.subject)(templateVars ?? {});
    }

    if (!renderedSubject || !renderedHtml) {
      throw new UnrecoverableError('Email must have subject and body');
    }

    const apiKey = this.config.get<string>('SENDGRID_API_KEY');

    if (!apiKey) {
      this.logger.warn('SENDGRID_API_KEY not configured - email not sent (dev mode)');
      this.logger.debug(`[DEV] Would send email: To: ${to}, Subject: ${renderedSubject}`);
    } else {
      await sgMail.send({
        to,
        from: from ?? { email: this.fromEmail, name: this.fromName },
        subject: renderedSubject,
        html: renderedHtml,
        text: plainText,
      });
    }

    // Update communication record status
    if (communicationId) {
      await this.prisma.withoutTenantScope(() =>
        this.prisma.communication.update({
          where: { id: communicationId },
          data: { status: 'SENT', sentAt: new Date() },
        }),
      );
    }

    this.logger.log(`Email sent successfully to ${to} (job ${job.id})`);
    return { success: true, to };
  }
}
