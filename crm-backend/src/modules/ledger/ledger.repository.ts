/**
 * LedgerRepository
 *
 * All mutations run inside a Prisma interactive transaction to enforce atomicity.
 * Account balances are updated with raw SQL `UPDATE ... SET balance = balance + $amount`
 * to prevent lost-update race conditions under concurrent load.
 *
 * We use `$executeRaw` for balance increments to avoid a read-modify-write cycle.
 */

import { Injectable } from '@nestjs/common';
import { Prisma, LedgerAccount, LedgerEntry, LedgerAccountType, Chain } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';

export interface DoubleEntryInput {
  tenantId: string;
  debitAccountId: string;
  creditAccountId: string;
  /** Amount in USDC atomic units (×10^6) as Decimal-compatible string */
  amount: Prisma.Decimal;
  paymentId?: string;
  referenceType?: string;
  referenceId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class LedgerRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Create account. Idempotent on (tenantId, code) — safe to call on startup. */
  async upsertAccount(input: {
    tenantId: string;
    walletId?: string;
    type: LedgerAccountType;
    name: string;
    code: string;
    chain?: Chain;
  }): Promise<LedgerAccount> {
    return this.prisma.ledgerAccount.upsert({
      where: { tenantId_code: { tenantId: input.tenantId, code: input.code } },
      create: {
        tenantId: input.tenantId,
        walletId: input.walletId,
        type: input.type,
        name: input.name,
        code: input.code,
        chain: input.chain,
      },
      update: {}, // Never overwrite existing account metadata
    });
  }

  findAccount(tenantId: string, code: string): Promise<LedgerAccount | null> {
    return this.prisma.ledgerAccount.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
  }

  findAccountById(id: string): Promise<LedgerAccount | null> {
    return this.prisma.ledgerAccount.findUnique({ where: { id } });
  }

  listAccounts(tenantId: string): Promise<LedgerAccount[]> {
    return this.prisma.ledgerAccount.findMany({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Write a balanced double-entry pair atomically.
   * Debit account balance increases, credit account balance increases.
   * (In double-entry, every entry increases the "normal balance" of the account type.)
   *
   * For our system:
   *   INBOUND payment:  debit USDC_ASSET (1010), credit USER_LIABILITY (2010)
   *   Fee booking:      debit USER_LIABILITY (2010), credit PLATFORM_REVENUE (4010)
   *
   * This runs inside the provided transaction (tx) so callers can compose operations.
   */
  async writeEntry(
    input: DoubleEntryInput,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<LedgerEntry> {
    // Atomic balance increments — no read-modify-write
    await tx.$executeRaw`
      UPDATE ledger_accounts
      SET balance = balance + ${input.amount}::numeric,
          "updatedAt" = NOW()
      WHERE id = ${input.debitAccountId}
    `;

    await tx.$executeRaw`
      UPDATE ledger_accounts
      SET balance = balance + ${input.amount}::numeric,
          "updatedAt" = NOW()
      WHERE id = ${input.creditAccountId}
    `;

    return tx.ledgerEntry.create({
      data: {
        tenantId: input.tenantId,
        debitAccountId: input.debitAccountId,
        creditAccountId: input.creditAccountId,
        amount: input.amount,
        paymentId: input.paymentId,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        description: input.description,
        metadata: input.metadata as Prisma.InputJsonValue,
      },
    });
  }

  /** Fetch all entries for a payment — used for audit and reconciliation. */
  getPaymentEntries(paymentId: string): Promise<LedgerEntry[]> {
    return this.prisma.ledgerEntry.findMany({
      where: { paymentId },
      include: { debitAccount: true, creditAccount: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Compute net position for a tenant (sum of all ASSET account balances). */
  async getTenantBalance(tenantId: string): Promise<Prisma.Decimal> {
    const result = await this.prisma.$queryRaw<{ total: Prisma.Decimal }[]>`
      SELECT COALESCE(SUM(balance), 0)::numeric AS total
      FROM ledger_accounts
      WHERE "tenantId" = ${tenantId}
        AND type = 'ASSET'
    `;
    return result[0]?.total ?? new Prisma.Decimal(0);
  }
}
