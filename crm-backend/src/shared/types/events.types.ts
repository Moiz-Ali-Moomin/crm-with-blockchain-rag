/**
 * Domain Event Types
 *
 * Defines all domain events that flow through the automation engine and
 * outbound webhook system. Moved here from the automation module because
 * these events are EMITTED by many modules (leads, deals, tickets, tasks)
 * and CONSUMED by the automation engine — keeping them in the automation
 * module would create tight coupling in the wrong direction.
 *
 * No NestJS imports — pure TypeScript.
 */

/** Every event type the CRM can emit */
export type DomainEventType =
  | 'LEAD_CREATED'
  | 'LEAD_STATUS_CHANGED'
  | 'LEAD_ASSIGNED'
  | 'CONTACT_CREATED'
  | 'CONTACT_UPDATED'
  | 'DEAL_CREATED'
  | 'DEAL_STAGE_CHANGED'
  | 'DEAL_UPDATED'
  | 'DEAL_WON'
  | 'DEAL_LOST'
  | 'TASK_CREATED'
  | 'TASK_OVERDUE'
  | 'TASK_COMPLETED'
  | 'TICKET_CREATED'
  | 'TICKET_STATUS_CHANGED'
  | 'TICKET_ASSIGNED'
  | 'COMPANY_CREATED';

/** The payload published to the automation queue and webhook queue */
export interface DomainEvent {
  tenantId: string;
  event: DomainEventType;
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
  /** ISO-8601 timestamp — defaults to now if omitted */
  triggeredAt?: string;
  /** The userId who triggered the event (for audit and template rendering) */
  actorId?: string;
}

// ─── Workflow Condition Types ───────────────────────────────────────────────

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'is_empty'
  | 'is_not_empty'
  | 'changed_to';

export interface WorkflowCondition {
  id: string;
  /** Dot-notation field path, e.g. "deal.value", "lead.status" */
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

export interface WorkflowConditionGroup {
  logic: 'AND' | 'OR';
  conditions: (WorkflowCondition | WorkflowConditionGroup)[];
}

// ─── Workflow Action Types ──────────────────────────────────────────────────

export type WorkflowActionType =
  | 'SEND_EMAIL'
  | 'SEND_SMS'
  | 'SEND_WHATSAPP'
  | 'CREATE_TASK'
  | 'UPDATE_FIELD'
  | 'ASSIGN_OWNER'
  | 'SEND_WEBHOOK'
  | 'CREATE_NOTIFICATION'
  | 'ADD_TAG'
  | 'WAIT';

export interface WorkflowAction {
  id: string;
  type: WorkflowActionType;
  /** Template variables use Handlebars syntax: {{lead.firstName}}, {{deal.value}} */
  config: Record<string, unknown>;
}
