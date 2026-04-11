import { BadRequestException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PaymentStateMachine } from './payment-state-machine';

describe('PaymentStateMachine', () => {
  // ── assertTransition ─────────────────────────────────────────────────────

  describe('assertTransition', () => {
    describe('valid transitions', () => {
      const cases: Array<[PaymentStatus, PaymentStatus]> = [
        ['PENDING',    'CONFIRMING'],
        ['PENDING',    'EXPIRED'],
        ['PENDING',    'FAILED'],
        ['CONFIRMING', 'COMPLETED'],
        ['CONFIRMING', 'FAILED'],
        ['COMPLETED',  'REFUNDED'],
      ];

      test.each(cases)('%s → %s does not throw', (from, to) => {
        expect(() => PaymentStateMachine.assertTransition(from, to)).not.toThrow();
      });
    });

    describe('same-state (idempotent no-op)', () => {
      const statuses: PaymentStatus[] = [
        'PENDING', 'CONFIRMING', 'COMPLETED', 'FAILED', 'REFUNDED', 'EXPIRED',
      ];

      test.each(statuses)('%s → %s is a no-op', (status) => {
        expect(() => PaymentStateMachine.assertTransition(status, status)).not.toThrow();
      });
    });

    describe('invalid transitions from non-terminal states', () => {
      const invalidCases: Array<[PaymentStatus, PaymentStatus]> = [
        ['PENDING',    'COMPLETED'],   // must go through CONFIRMING first
        ['PENDING',    'REFUNDED'],
        ['CONFIRMING', 'PENDING'],     // no going back
        ['CONFIRMING', 'EXPIRED'],
        ['CONFIRMING', 'REFUNDED'],
      ];

      test.each(invalidCases)('%s → %s throws BadRequestException', (from, to) => {
        expect(() => PaymentStateMachine.assertTransition(from, to)).toThrow(
          BadRequestException,
        );
      });
    });

    describe('transitions from terminal states are always forbidden', () => {
      const terminalStates: PaymentStatus[] = ['COMPLETED', 'FAILED', 'REFUNDED', 'EXPIRED'];
      const targets: PaymentStatus[] = ['PENDING', 'CONFIRMING', 'COMPLETED', 'FAILED'];

      terminalStates.forEach((from) => {
        targets
          .filter((to) => {
            // Skip same-state no-ops — those are allowed
            if (from === to) return false;
            // COMPLETED → REFUNDED is a valid transition
            if (from === 'COMPLETED' && to === 'REFUNDED') return false;
            return true;
          })
          .forEach((to) => {
            test(`${from} → ${to} throws BadRequestException`, () => {
              expect(() => PaymentStateMachine.assertTransition(from, to)).toThrow(
                BadRequestException,
              );
            });
          });
      });

      test('FAILED → PENDING throws with "terminal state" message', () => {
        expect(() => PaymentStateMachine.assertTransition('FAILED', 'PENDING')).toThrow(
          /terminal state FAILED/,
        );
      });

      test('EXPIRED → CONFIRMING throws with "terminal state" message', () => {
        expect(() => PaymentStateMachine.assertTransition('EXPIRED', 'CONFIRMING')).toThrow(
          /terminal state EXPIRED/,
        );
      });

      test('REFUNDED → PENDING throws with "terminal state" message', () => {
        expect(() => PaymentStateMachine.assertTransition('REFUNDED', 'PENDING')).toThrow(
          /terminal state REFUNDED/,
        );
      });
    });

    describe('error message quality', () => {
      it('includes both from and to states in the invalid-transition message', () => {
        expect(() => PaymentStateMachine.assertTransition('CONFIRMING', 'PENDING')).toThrow(
          /CONFIRMING.*PENDING/,
        );
      });
    });
  });

  // ── isTerminal ───────────────────────────────────────────────────────────

  describe('isTerminal', () => {
    const terminalCases: Array<[PaymentStatus, boolean]> = [
      ['COMPLETED', true],
      ['FAILED',    true],
      ['REFUNDED',  true],
      ['EXPIRED',   true],
      ['PENDING',   false],
      ['CONFIRMING',false],
    ];

    test.each(terminalCases)('%s → isTerminal = %s', (status, expected) => {
      expect(PaymentStateMachine.isTerminal(status)).toBe(expected);
    });
  });

  // ── canAcceptDeposit ─────────────────────────────────────────────────────

  describe('canAcceptDeposit', () => {
    it('returns true only for PENDING', () => {
      expect(PaymentStateMachine.canAcceptDeposit('PENDING')).toBe(true);
    });

    const nonPending: PaymentStatus[] = [
      'CONFIRMING', 'COMPLETED', 'FAILED', 'REFUNDED', 'EXPIRED',
    ];

    test.each(nonPending)('%s returns false', (status) => {
      expect(PaymentStateMachine.canAcceptDeposit(status)).toBe(false);
    });
  });
});
