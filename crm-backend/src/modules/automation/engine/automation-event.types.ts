/**
 * Automation Event Types — re-exported from shared/types/events.types.ts
 *
 * Domain events are now defined in shared/ because they are emitted by many
 * modules (leads, deals, tickets) and consumed by the automation engine.
 * Keeping the source of truth in shared/ breaks the coupling from
 * automation → other modules.
 *
 * All existing imports from this file continue to work unchanged.
 */

export type {
  DomainEventType as AutomationEventType,
  DomainEvent as AutomationTriggerPayload,
  ConditionOperator,
  WorkflowCondition,
  WorkflowConditionGroup,
  WorkflowActionType,
  WorkflowAction,
} from '../../../shared/types/events.types';
