/**
 * Condition Evaluator
 *
 * Evaluates AND/OR condition trees against event data.
 * Supports nested groups: (A AND B) OR (C AND D)
 *
 * Field resolution supports dot notation:
 * - "deal.value" → data.deal.value
 * - "lead.status" → data.lead.status
 */

import { Injectable } from '@nestjs/common';
import {
  WorkflowCondition,
  WorkflowConditionGroup,
  ConditionOperator,
} from './automation-event.types';

@Injectable()
export class ConditionEvaluator {
  /**
   * Evaluate a condition group (or single condition) against event data
   */
  evaluate(
    conditionGroup: WorkflowConditionGroup,
    data: Record<string, unknown>,
  ): boolean {
    const results = conditionGroup.conditions.map((condition) => {
      if ('logic' in condition) {
        // Nested group - recurse
        return this.evaluate(condition as WorkflowConditionGroup, data);
      } else {
        return this.evaluateCondition(condition as WorkflowCondition, data);
      }
    });

    return conditionGroup.logic === 'AND'
      ? results.every(Boolean)
      : results.some(Boolean);
  }

  private evaluateCondition(
    condition: WorkflowCondition,
    data: Record<string, unknown>,
  ): boolean {
    const actualValue = this.resolveField(condition.field, data);

    switch (condition.operator as ConditionOperator) {
      case 'eq':
        return actualValue === condition.value;
      case 'neq':
        return actualValue !== condition.value;
      case 'gt':
        return Number(actualValue) > Number(condition.value);
      case 'gte':
        return Number(actualValue) >= Number(condition.value);
      case 'lt':
        return Number(actualValue) < Number(condition.value);
      case 'lte':
        return Number(actualValue) <= Number(condition.value);
      case 'contains':
        return String(actualValue).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'not_contains':
        return !String(actualValue).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'in':
        return Array.isArray(condition.value)
          ? condition.value.includes(actualValue)
          : false;
      case 'not_in':
        return Array.isArray(condition.value)
          ? !condition.value.includes(actualValue)
          : true;
      case 'is_empty':
        return actualValue === null || actualValue === undefined || actualValue === '';
      case 'is_not_empty':
        return actualValue !== null && actualValue !== undefined && actualValue !== '';
      case 'changed_to':
        // Special operator: checks if field value matches in the "after" state
        return actualValue === condition.value;
      default:
        return false;
    }
  }

  /**
   * Resolve dot-notation field path from data object
   * Example: "deal.contact.email" → data.deal.contact.email
   */
  private resolveField(fieldPath: string, data: Record<string, unknown>): unknown {
    return fieldPath.split('.').reduce((obj: unknown, key: string) => {
      if (obj === null || obj === undefined) return undefined;
      return (obj as Record<string, unknown>)[key];
    }, data);
  }
}
