/**
 * Action Executor
 *
 * Executes workflow actions after conditions are met.
 * Each action type dispatches to the appropriate queue or performs a direct DB update.
 * Template variables like {{lead.firstName}} are resolved from event data.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WorkflowAction } from './automation-event.types';
import { PrismaService } from '../../../core/database/prisma.service';
import { QUEUE_NAMES } from '../../../core/queue/queue.constants';
import { renderTemplate } from '../../../shared/utils/template.utils';

/**
 * Whitelist of Prisma model names that automation actions are allowed to touch.
 * Prevents privilege escalation via workflow config (e.g. entityType: "user").
 */
const ALLOWED_AUTOMATION_MODELS = new Set(['lead', 'contact', 'deal', 'ticket', 'task']);

/**
 * Per-model whitelist of fields that UPDATE_FIELD action may set.
 * Never expose auth fields (passwordHash, refreshTokenHash, role, tenantId).
 */
const ALLOWED_UPDATE_FIELDS: Record<string, Set<string>> = {
  lead:    new Set(['status', 'score', 'notes', 'assigneeId', 'lastContactedAt', 'tags']),
  contact: new Set(['notes', 'jobTitle', 'phone', 'lastContactedAt']),
  deal:    new Set(['status', 'closingDate', 'lostReason', 'description', 'value']),
  ticket:  new Set(['status', 'priority', 'assigneeId']),
  task:    new Set(['status', 'priority', 'dueDate', 'description']),
};

export interface ActionResult {
  actionId: string;
  type: string;
  success: boolean;
  error?: string;
}

@Injectable()
export class ActionExecutor {
  private readonly logger = new Logger(ActionExecutor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SMS) private readonly smsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATION) private readonly notificationQueue: Queue,
  ) {}

  async execute(
    action: WorkflowAction,
    data: Record<string, unknown>,
    tenantId: string,
  ): Promise<ActionResult> {
    try {
      switch (action.type) {
        case 'SEND_EMAIL':
          await this.executeSendEmail(action, data, tenantId);
          break;

        case 'SEND_SMS':
          await this.executeSendSms(action, data, tenantId);
          break;

        case 'CREATE_TASK':
          await this.executeCreateTask(action, data, tenantId);
          break;

        case 'UPDATE_FIELD':
          await this.executeUpdateField(action, data, tenantId);
          break;

        case 'ASSIGN_OWNER':
          await this.executeAssignOwner(action, data, tenantId);
          break;

        case 'CREATE_NOTIFICATION':
          await this.executeCreateNotification(action, data, tenantId);
          break;

        case 'ADD_TAG':
          await this.executeAddTag(action, data, tenantId);
          break;

        default:
          this.logger.warn(`Unknown action type: ${action.type}`);
      }

      return { actionId: action.id, type: action.type, success: true };
    } catch (error) {
      this.logger.error(`Action ${action.type} failed: ${(error as Error).message}`);
      return {
        actionId: action.id,
        type: action.type,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  private async executeSendEmail(
    action: WorkflowAction,
    data: Record<string, unknown>,
    tenantId: string,
  ) {
    const config = action.config as {
      to: string;
      templateId?: string;
      subject?: string;
      body?: string;
    };

    const to = this.renderTemplate(config.to, data);
    const subject = config.subject ? this.renderTemplate(config.subject, data) : undefined;
    const body = config.body ? this.renderTemplate(config.body, data) : undefined;

    await this.emailQueue.add('automation-email', {
      tenantId,
      to,
      templateId: config.templateId,
      subject,
      body,
      data, // Pass for template rendering in the worker
    });
  }

  private async executeSendSms(
    action: WorkflowAction,
    data: Record<string, unknown>,
    tenantId: string,
  ) {
    const config = action.config as { to: string; message: string };
    await this.smsQueue.add('automation-sms', {
      tenantId,
      to: this.renderTemplate(config.to, data),
      message: this.renderTemplate(config.message, data),
    });
  }

  private async executeCreateTask(
    action: WorkflowAction,
    data: Record<string, unknown>,
    tenantId: string,
  ) {
    const config = action.config as {
      title: string;
      description?: string;
      assignTo?: string;
      dueDays?: number;
      priority?: string;
      entityType?: string;
    };

    const entityId = (data as any).entityId as string | undefined;
    const dueDate = config.dueDays
      ? new Date(Date.now() + config.dueDays * 24 * 60 * 60 * 1000)
      : undefined;

    await this.prisma.task.create({
      data: {
        tenantId,
        title: this.renderTemplate(config.title, data),
        description: config.description ? this.renderTemplate(config.description, data) : undefined,
        assigneeId: config.assignTo ? this.renderTemplate(config.assignTo, data) : undefined,
        priority: (config.priority as any) ?? 'MEDIUM',
        dueDate,
        entityType: config.entityType as any,
        entityId,
        createdById: (data as any).actorId || (data as any).userId || undefined,
      },
    });
  }

  private async executeUpdateField(
    action: WorkflowAction,
    data: Record<string, unknown>,
    tenantId: string,
  ) {
    const config = action.config as {
      entityType: string;
      entityId?: string;
      field: string;
      value: unknown;
    };

    const modelKey = config.entityType.toLowerCase();

    if (!ALLOWED_AUTOMATION_MODELS.has(modelKey)) {
      this.logger.warn(`UPDATE_FIELD blocked: entityType "${config.entityType}" is not in the automation whitelist`);
      return;
    }

    const allowedFields = ALLOWED_UPDATE_FIELDS[modelKey];
    if (!allowedFields?.has(config.field)) {
      this.logger.warn(`UPDATE_FIELD blocked: field "${config.field}" is not allowed for model "${modelKey}"`);
      return;
    }

    const entityId = config.entityId
      ? this.renderTemplate(String(config.entityId), data)
      : (data as any).entityId;

    if (!entityId) {
      this.logger.warn(`UPDATE_FIELD skipped: no entityId resolved for ${modelKey}`);
      return;
    }

    const updateData = { [config.field]: config.value };

    // Worker has no ALS context — scope the update to the correct tenant explicitly
    const model = (this.prisma as any)[modelKey];
    await model.update({ where: { id: entityId, tenantId }, data: updateData });
  }

  private async executeAssignOwner(
    action: WorkflowAction,
    data: Record<string, unknown>,
    tenantId: string,
  ) {
    const config = action.config as {
      entityType: string;
      userId: string;
    };

    const modelKey = config.entityType.toLowerCase();

    if (!ALLOWED_AUTOMATION_MODELS.has(modelKey)) {
      this.logger.warn(`ASSIGN_OWNER blocked: entityType "${config.entityType}" is not in the automation whitelist`);
      return;
    }

    const entityId = (data as any).entityId;
    const userId = this.renderTemplate(config.userId, data);

    if (!entityId || !userId) return;

    const updateData = { ownerId: userId };
    const model = (this.prisma as any)[modelKey];
    // Scope to tenant — worker has no ALS context
    await model.update({ where: { id: entityId, tenantId }, data: updateData });
  }

  private async executeCreateNotification(
    action: WorkflowAction,
    data: Record<string, unknown>,
    tenantId: string,
  ) {
    const config = action.config as {
      userId: string;
      title: string;
      body: string;
      type: string;
    };

    await this.notificationQueue.add('automation-notification', {
      tenantId,
      userId: this.renderTemplate(config.userId, data),
      title: this.renderTemplate(config.title, data),
      body: this.renderTemplate(config.body, data),
      type: config.type,
      entityType: (data as any).entityType,
      entityId: (data as any).entityId,
    });
  }

  private async executeAddTag(
    action: WorkflowAction,
    data: Record<string, unknown>,
    tenantId: string,
  ) {
    const config = action.config as { entityType: string; tag: string };
    const modelKey = config.entityType.toLowerCase();
    const entityId = (data as any).entityId;

    if (!ALLOWED_AUTOMATION_MODELS.has(modelKey) || !entityId) {
      this.logger.warn(`ADD_TAG blocked: entityType "${config.entityType}" is not in the automation whitelist`);
      return;
    }

    const model = (this.prisma as any)[modelKey];
    await model.update({
      where: { id: entityId, tenantId }, // tenant-scoped
      data: { tags: { push: config.tag } },
    });
  }

  /**
   * Delegates to shared/utils/template.utils — renderTemplate is now the
   * single Handlebars rendering point for the entire application.
   */
  private renderTemplate(template: string, data: Record<string, unknown>): string {
    return renderTemplate(template, data);
  }
}
