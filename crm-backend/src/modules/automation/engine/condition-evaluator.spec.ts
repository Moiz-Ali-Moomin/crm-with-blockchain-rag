import { Test, TestingModule } from '@nestjs/testing';
import { ConditionEvaluator } from './condition-evaluator';
import { WorkflowConditionGroup, WorkflowCondition } from './automation-event.types';

// Helper to build a single-condition group
function makeGroup(
  logic: 'AND' | 'OR',
  conditions: (WorkflowCondition | WorkflowConditionGroup)[],
): WorkflowConditionGroup {
  return { logic, conditions };
}

function makeCondition(
  field: string,
  operator: WorkflowCondition['operator'],
  value: unknown,
): WorkflowCondition {
  return { id: `cond-${field}`, field, operator, value };
}

describe('ConditionEvaluator', () => {
  let evaluator: ConditionEvaluator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConditionEvaluator],
    }).compile();

    evaluator = module.get<ConditionEvaluator>(ConditionEvaluator);
  });

  // ── Scalar operators ─────────────────────────────────────────────────────

  describe('eq / neq', () => {
    it('eq matches exact value', () => {
      const group = makeGroup('AND', [makeCondition('status', 'eq', 'WON')]);
      expect(evaluator.evaluate(group, { status: 'WON' })).toBe(true);
    });

    it('eq fails on different value', () => {
      const group = makeGroup('AND', [makeCondition('status', 'eq', 'WON')]);
      expect(evaluator.evaluate(group, { status: 'LOST' })).toBe(false);
    });

    it('neq passes when value differs', () => {
      const group = makeGroup('AND', [makeCondition('status', 'neq', 'LOST')]);
      expect(evaluator.evaluate(group, { status: 'WON' })).toBe(true);
    });

    it('neq fails when value matches', () => {
      const group = makeGroup('AND', [makeCondition('status', 'neq', 'WON')]);
      expect(evaluator.evaluate(group, { status: 'WON' })).toBe(false);
    });
  });

  // ── Numeric comparison operators ─────────────────────────────────────────

  describe('gt / gte / lt / lte', () => {
    const data = { value: 500 };

    it('gt passes when actual > threshold', () => {
      expect(evaluator.evaluate(makeGroup('AND', [makeCondition('value', 'gt', 499)]), data)).toBe(true);
    });

    it('gt fails when actual === threshold', () => {
      expect(evaluator.evaluate(makeGroup('AND', [makeCondition('value', 'gt', 500)]), data)).toBe(false);
    });

    it('gte passes when actual === threshold', () => {
      expect(evaluator.evaluate(makeGroup('AND', [makeCondition('value', 'gte', 500)]), data)).toBe(true);
    });

    it('gte passes when actual > threshold', () => {
      expect(evaluator.evaluate(makeGroup('AND', [makeCondition('value', 'gte', 499)]), data)).toBe(true);
    });

    it('lt passes when actual < threshold', () => {
      expect(evaluator.evaluate(makeGroup('AND', [makeCondition('value', 'lt', 501)]), data)).toBe(true);
    });

    it('lt fails when actual === threshold', () => {
      expect(evaluator.evaluate(makeGroup('AND', [makeCondition('value', 'lt', 500)]), data)).toBe(false);
    });

    it('lte passes when actual === threshold', () => {
      expect(evaluator.evaluate(makeGroup('AND', [makeCondition('value', 'lte', 500)]), data)).toBe(true);
    });

    it('lte fails when actual > threshold', () => {
      expect(evaluator.evaluate(makeGroup('AND', [makeCondition('value', 'lte', 499)]), data)).toBe(false);
    });
  });

  // ── String operators ─────────────────────────────────────────────────────

  describe('contains / not_contains', () => {
    it('contains is case-insensitive', () => {
      const group = makeGroup('AND', [makeCondition('title', 'contains', 'ACME')]);
      expect(evaluator.evaluate(group, { title: 'Deal with Acme Corp' })).toBe(true);
    });

    it('contains fails when substring absent', () => {
      const group = makeGroup('AND', [makeCondition('title', 'contains', 'xyz')]);
      expect(evaluator.evaluate(group, { title: 'Deal with Acme Corp' })).toBe(false);
    });

    it('not_contains passes when substring absent', () => {
      const group = makeGroup('AND', [makeCondition('title', 'not_contains', 'xyz')]);
      expect(evaluator.evaluate(group, { title: 'Deal with Acme Corp' })).toBe(true);
    });

    it('not_contains fails when substring present', () => {
      const group = makeGroup('AND', [makeCondition('title', 'not_contains', 'Acme')]);
      expect(evaluator.evaluate(group, { title: 'Deal with Acme Corp' })).toBe(false);
    });
  });

  // ── Array operators ──────────────────────────────────────────────────────

  describe('in / not_in', () => {
    it('in passes when value is in the array', () => {
      const group = makeGroup('AND', [makeCondition('priority', 'in', ['HIGH', 'CRITICAL'])]);
      expect(evaluator.evaluate(group, { priority: 'HIGH' })).toBe(true);
    });

    it('in fails when value is not in the array', () => {
      const group = makeGroup('AND', [makeCondition('priority', 'in', ['HIGH', 'CRITICAL'])]);
      expect(evaluator.evaluate(group, { priority: 'LOW' })).toBe(false);
    });

    it('in returns false when condition.value is not an array', () => {
      const group = makeGroup('AND', [makeCondition('priority', 'in', 'HIGH')]);
      expect(evaluator.evaluate(group, { priority: 'HIGH' })).toBe(false);
    });

    it('not_in passes when value is absent from the array', () => {
      const group = makeGroup('AND', [makeCondition('priority', 'not_in', ['LOW', 'MEDIUM'])]);
      expect(evaluator.evaluate(group, { priority: 'HIGH' })).toBe(true);
    });

    it('not_in fails when value is in the array', () => {
      const group = makeGroup('AND', [makeCondition('priority', 'not_in', ['HIGH'])]);
      expect(evaluator.evaluate(group, { priority: 'HIGH' })).toBe(false);
    });

    it('not_in returns true when condition.value is not an array', () => {
      const group = makeGroup('AND', [makeCondition('priority', 'not_in', 'HIGH')]);
      expect(evaluator.evaluate(group, { priority: 'HIGH' })).toBe(true);
    });
  });

  // ── Existence operators ──────────────────────────────────────────────────

  describe('is_empty / is_not_empty', () => {
    it('is_empty passes for null', () => {
      const group = makeGroup('AND', [makeCondition('ownerId', 'is_empty', null)]);
      expect(evaluator.evaluate(group, { ownerId: null })).toBe(true);
    });

    it('is_empty passes for undefined', () => {
      const group = makeGroup('AND', [makeCondition('ownerId', 'is_empty', null)]);
      expect(evaluator.evaluate(group, {})).toBe(true);
    });

    it('is_empty passes for empty string', () => {
      const group = makeGroup('AND', [makeCondition('notes', 'is_empty', null)]);
      expect(evaluator.evaluate(group, { notes: '' })).toBe(true);
    });

    it('is_empty fails for non-empty value', () => {
      const group = makeGroup('AND', [makeCondition('ownerId', 'is_empty', null)]);
      expect(evaluator.evaluate(group, { ownerId: 'user-123' })).toBe(false);
    });

    it('is_not_empty passes for non-empty value', () => {
      const group = makeGroup('AND', [makeCondition('ownerId', 'is_not_empty', null)]);
      expect(evaluator.evaluate(group, { ownerId: 'user-123' })).toBe(true);
    });

    it('is_not_empty fails for null', () => {
      const group = makeGroup('AND', [makeCondition('ownerId', 'is_not_empty', null)]);
      expect(evaluator.evaluate(group, { ownerId: null })).toBe(false);
    });
  });

  // ── changed_to operator ──────────────────────────────────────────────────

  describe('changed_to', () => {
    it('passes when field matches the target value', () => {
      const group = makeGroup('AND', [makeCondition('status', 'changed_to', 'WON')]);
      expect(evaluator.evaluate(group, { status: 'WON' })).toBe(true);
    });

    it('fails when field does not match the target value', () => {
      const group = makeGroup('AND', [makeCondition('status', 'changed_to', 'WON')]);
      expect(evaluator.evaluate(group, { status: 'OPEN' })).toBe(false);
    });
  });

  // ── unknown operator ─────────────────────────────────────────────────────

  describe('unknown operator', () => {
    it('returns false for unrecognised operators', () => {
      const group: WorkflowConditionGroup = {
        logic: 'AND',
        conditions: [
          {
            id: 'cond-x',
            field: 'status',
            operator: 'UNKNOWN_OP' as any,
            value: 'WON',
          },
        ],
      };
      expect(evaluator.evaluate(group, { status: 'WON' })).toBe(false);
    });
  });

  // ── Dot-notation field resolution ────────────────────────────────────────

  describe('dot-notation field resolution', () => {
    it('resolves a single-level path', () => {
      const group = makeGroup('AND', [makeCondition('deal.value', 'gt', 1000)]);
      expect(evaluator.evaluate(group, { deal: { value: 5000 } })).toBe(true);
    });

    it('resolves a two-level nested path', () => {
      const group = makeGroup('AND', [makeCondition('deal.contact.email', 'contains', '@acme')]);
      expect(evaluator.evaluate(group, {
        deal: { contact: { email: 'ceo@acme.com' } },
      })).toBe(true);
    });

    it('returns undefined (is_empty) when intermediate key is missing', () => {
      const group = makeGroup('AND', [makeCondition('deal.owner.id', 'is_empty', null)]);
      expect(evaluator.evaluate(group, { deal: {} })).toBe(true);
    });

    it('returns undefined (is_empty) when top-level key is missing', () => {
      const group = makeGroup('AND', [makeCondition('lead.status', 'is_empty', null)]);
      expect(evaluator.evaluate(group, {})).toBe(true);
    });

    it('returns undefined (is_empty) when intermediate value is null', () => {
      const group = makeGroup('AND', [makeCondition('deal.contact.id', 'is_empty', null)]);
      expect(evaluator.evaluate(group, { deal: { contact: null } })).toBe(true);
    });
  });

  // ── AND logic ────────────────────────────────────────────────────────────

  describe('AND group logic', () => {
    it('returns true when ALL conditions pass', () => {
      const group = makeGroup('AND', [
        makeCondition('status', 'eq', 'WON'),
        makeCondition('value', 'gt', 1000),
      ]);
      expect(evaluator.evaluate(group, { status: 'WON', value: 5000 })).toBe(true);
    });

    it('returns false when ANY condition fails', () => {
      const group = makeGroup('AND', [
        makeCondition('status', 'eq', 'WON'),
        makeCondition('value', 'gt', 10000), // fails — value is 5000
      ]);
      expect(evaluator.evaluate(group, { status: 'WON', value: 5000 })).toBe(false);
    });

    it('returns true for empty AND group (vacuously true)', () => {
      const group = makeGroup('AND', []);
      expect(evaluator.evaluate(group, {})).toBe(true);
    });
  });

  // ── OR logic ─────────────────────────────────────────────────────────────

  describe('OR group logic', () => {
    it('returns true when ANY condition passes', () => {
      const group = makeGroup('OR', [
        makeCondition('status', 'eq', 'WON'),
        makeCondition('status', 'eq', 'LOST'), // also matches
      ]);
      expect(evaluator.evaluate(group, { status: 'LOST' })).toBe(true);
    });

    it('returns false when ALL conditions fail', () => {
      const group = makeGroup('OR', [
        makeCondition('status', 'eq', 'WON'),
        makeCondition('status', 'eq', 'CLOSED'),
      ]);
      expect(evaluator.evaluate(group, { status: 'OPEN' })).toBe(false);
    });

    it('returns false for empty OR group (vacuously false)', () => {
      const group = makeGroup('OR', []);
      expect(evaluator.evaluate(group, {})).toBe(false);
    });
  });

  // ── Nested group logic ───────────────────────────────────────────────────

  describe('nested condition groups', () => {
    it('evaluates (A AND B) OR (C AND D) — first branch matches', () => {
      // (status=WON AND value>1000) OR (priority=HIGH AND region=EU)
      const group: WorkflowConditionGroup = makeGroup('OR', [
        makeGroup('AND', [
          makeCondition('status', 'eq', 'WON'),
          makeCondition('value', 'gt', 1000),
        ]),
        makeGroup('AND', [
          makeCondition('priority', 'eq', 'HIGH'),
          makeCondition('region', 'eq', 'EU'),
        ]),
      ]);
      expect(evaluator.evaluate(group, { status: 'WON', value: 5000, priority: 'LOW', region: 'US' })).toBe(true);
    });

    it('evaluates (A AND B) OR (C AND D) — second branch matches', () => {
      const group: WorkflowConditionGroup = makeGroup('OR', [
        makeGroup('AND', [
          makeCondition('status', 'eq', 'WON'),
          makeCondition('value', 'gt', 1000),
        ]),
        makeGroup('AND', [
          makeCondition('priority', 'eq', 'HIGH'),
          makeCondition('region', 'eq', 'EU'),
        ]),
      ]);
      expect(evaluator.evaluate(group, { status: 'OPEN', value: 500, priority: 'HIGH', region: 'EU' })).toBe(true);
    });

    it('evaluates (A AND B) OR (C AND D) — neither branch matches', () => {
      const group: WorkflowConditionGroup = makeGroup('OR', [
        makeGroup('AND', [
          makeCondition('status', 'eq', 'WON'),
          makeCondition('value', 'gt', 1000),
        ]),
        makeGroup('AND', [
          makeCondition('priority', 'eq', 'HIGH'),
          makeCondition('region', 'eq', 'EU'),
        ]),
      ]);
      expect(evaluator.evaluate(group, { status: 'OPEN', value: 500, priority: 'LOW', region: 'US' })).toBe(false);
    });

    it('handles 3-level deep nesting', () => {
      // A AND (B OR (C AND D))
      const group: WorkflowConditionGroup = makeGroup('AND', [
        makeCondition('tenantPlan', 'eq', 'ENTERPRISE'),
        makeGroup('OR', [
          makeCondition('dealCount', 'gt', 100),
          makeGroup('AND', [
            makeCondition('mrr', 'gte', 5000),
            makeCondition('region', 'eq', 'NA'),
          ]),
        ]),
      ]);

      // tenantPlan=ENTERPRISE, dealCount=5, mrr=6000, region=NA → should match via inner AND
      expect(evaluator.evaluate(group, {
        tenantPlan: 'ENTERPRISE',
        dealCount: 5,
        mrr: 6000,
        region: 'NA',
      })).toBe(true);

      // tenantPlan=ENTERPRISE, dealCount=5, mrr=1000, region=EU → should NOT match
      expect(evaluator.evaluate(group, {
        tenantPlan: 'ENTERPRISE',
        dealCount: 5,
        mrr: 1000,
        region: 'EU',
      })).toBe(false);

      // tenantPlan=STARTER → outer AND short-circuits
      expect(evaluator.evaluate(group, {
        tenantPlan: 'STARTER',
        dealCount: 500,
        mrr: 9999,
        region: 'NA',
      })).toBe(false);
    });
  });

  // ── Real-world scenarios ─────────────────────────────────────────────────

  describe('real-world CRM scenarios', () => {
    it('triggers "high-value deal won" automation', () => {
      // Trigger when: deal.status changed_to WON AND deal.value >= 10000
      const group = makeGroup('AND', [
        makeCondition('deal.status', 'changed_to', 'WON'),
        makeCondition('deal.value', 'gte', 10000),
      ]);
      expect(evaluator.evaluate(group, { deal: { status: 'WON', value: 25000 } })).toBe(true);
      expect(evaluator.evaluate(group, { deal: { status: 'WON', value: 5000 } })).toBe(false);
    });

    it('triggers "unassigned lead" automation', () => {
      // Trigger when: lead.status eq NEW AND lead.ownerId is_empty
      const group = makeGroup('AND', [
        makeCondition('lead.status', 'eq', 'NEW'),
        makeCondition('lead.ownerId', 'is_empty', null),
      ]);
      expect(evaluator.evaluate(group, { lead: { status: 'NEW', ownerId: null } })).toBe(true);
      expect(evaluator.evaluate(group, { lead: { status: 'NEW', ownerId: 'user-1' } })).toBe(false);
    });

    it('triggers "overdue ticket" automation', () => {
      // Trigger when: ticket.priority in [HIGH, CRITICAL] AND ticket.status neq RESOLVED
      const group = makeGroup('AND', [
        makeCondition('ticket.priority', 'in', ['HIGH', 'CRITICAL']),
        makeCondition('ticket.status', 'neq', 'RESOLVED'),
      ]);
      expect(evaluator.evaluate(group, { ticket: { priority: 'CRITICAL', status: 'OPEN' } })).toBe(true);
      expect(evaluator.evaluate(group, { ticket: { priority: 'CRITICAL', status: 'RESOLVED' } })).toBe(false);
      expect(evaluator.evaluate(group, { ticket: { priority: 'LOW', status: 'OPEN' } })).toBe(false);
    });
  });
});
