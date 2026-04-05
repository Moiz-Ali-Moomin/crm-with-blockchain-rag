/**
 * EventLog — MongoDB collection for high-volume system events
 *
 * Captures three event categories:
 *  1. Activity events   — CRM entity state changes (lead converted, deal moved, etc.)
 *  2. Webhook events    — outbound webhook delivery attempts (success/failure/retry)
 *  3. Automation events — workflow trigger evaluations and action executions
 *
 * Why MongoDB (not PostgreSQL AuditLog):
 * - AuditLog in Prisma tracks user-facing mutations (WHO changed WHAT) for compliance
 * - EventLog tracks system-level events at much higher volume (automation alone can emit
 *   hundreds of events per minute per tenant on a busy CRM)
 * - EventLog payload is schema-less per eventType — fits document model naturally
 * - Time-series access pattern (scan by time range) maps to MongoDB's strengths
 *
 * Multi-tenancy: tenantId REQUIRED on every document.
 */

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EventLogDocument = HydratedDocument<EventLog>;

export type EventCategory = 'activity' | 'webhook' | 'automation';

export type EventLogStatus = 'success' | 'failure' | 'pending' | 'skipped';

@Schema({
  collection: 'event_logs',
  timestamps: true,
})
export class EventLog {
  /**
   * Tenant isolation — REQUIRED on every document.
   */
  @Prop({ type: String, required: true, index: true })
  tenantId: string;

  /**
   * Broad category of the event — used for routing to different dashboards.
   */
  @Prop({ type: String, required: true, enum: ['activity', 'webhook', 'automation'] })
  category: EventCategory;

  /**
   * Fine-grained event name.
   *
   * Activity examples:  'lead.created', 'deal.stage_changed', 'contact.updated'
   * Webhook examples:   'webhook.delivered', 'webhook.failed', 'webhook.retried'
   * Automation examples:'automation.triggered', 'automation.action_executed', 'automation.skipped'
   */
  @Prop({ type: String, required: true })
  eventType: string;

  /**
   * Outcome of this event processing.
   */
  @Prop({ type: String, required: true, enum: ['success', 'failure', 'pending', 'skipped'] })
  status: EventLogStatus;

  /**
   * The primary entity this event is about (Prisma UUID).
   * For webhook events, this is the webhookConfigId.
   * For automation events, this is the workflowId.
   */
  @Prop({ type: String })
  entityId?: string;

  /**
   * Entity model name — matches Prisma model names for consistency.
   * e.g. 'Lead', 'Deal', 'Contact', 'WebhookConfig', 'Workflow'
   */
  @Prop({ type: String })
  entityType?: string;

  /**
   * The user who triggered this event (if applicable).
   * Null for background/automated events.
   */
  @Prop({ type: String })
  triggeredBy?: string;

  /**
   * Schema-less payload — shape varies by category + eventType.
   *
   * Activity event payload example:
   *   { previousStatus: 'NEW', newStatus: 'QUALIFIED', changedFields: ['status', 'score'] }
   *
   * Webhook event payload example:
   *   { url: '...', responseStatus: 200, responseTimeMs: 145, attempt: 1 }
   *
   * Automation event payload example:
   *   { workflowId: '...', actionType: 'SEND_EMAIL', conditionResult: true, targetEntityId: '...' }
   */
  @Prop({ type: Object, default: {} })
  payload: Record<string, unknown>;

  /**
   * Error message when status === 'failure'.
   * Truncated to 2000 chars to prevent unbounded storage.
   */
  @Prop({ type: String })
  errorMessage?: string;

  /**
   * Distributed tracing — links this event to the HTTP request that caused it.
   * Populated from the X-Request-ID header via RequestIdMiddleware.
   */
  @Prop({ type: String })
  requestId?: string;

  /**
   * Duration of the event processing in milliseconds.
   * For webhook delivery: total time including HTTP call.
   * For automation action: time to execute the action.
   */
  @Prop({ type: Number })
  durationMs?: number;

  // Injected by { timestamps: true }
  createdAt: Date;
  updatedAt: Date;
}

export const EventLogSchema = SchemaFactory.createForClass(EventLog);

// ─── Indexes ────────────────────────────────────────────────────────────────

/**
 * Primary access: "get all events for tenant X in the last 24 hours"
 */
EventLogSchema.index({ tenantId: 1, createdAt: -1 });

/**
 * Category + time: "show me all automation events for tenant X this week"
 */
EventLogSchema.index({ tenantId: 1, category: 1, createdAt: -1 });

/**
 * Entity timeline: "show all events related to deal X"
 */
EventLogSchema.index({ tenantId: 1, entityType: 1, entityId: 1, createdAt: -1 });

/**
 * Failure monitoring: "show me all failed webhook deliveries"
 */
EventLogSchema.index({ tenantId: 1, status: 1, category: 1, createdAt: -1 });

/**
 * Distributed tracing: correlate events back to a specific HTTP request
 */
EventLogSchema.index({ requestId: 1 }, { sparse: true });
