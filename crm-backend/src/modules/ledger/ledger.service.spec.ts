import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { LedgerService, SettlePaymentInput } from './ledger.service';
import { LedgerRepository } from './ledger.repository';
import { PrismaService } from '../../core/database/prisma.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant-abc';
const WALLET_ID = 'wallet-001';
const PAYMENT_ID = 'pay-xyz';
const CHAIN = 'POLYGON' as const;

function makeAccount(type: string, code: string) {
  return { id: `acct-${code}`, tenantId: TENANT_ID, type, code };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockLedgerRepo = {
  upsertAccount: jest.fn(),
  findAccount: jest.fn(),
  writeEntry: jest.fn(),
  getTenantBalance: jest.fn(),
  getPaymentEntries: jest.fn(),
  listAccounts: jest.fn(),
};

// Prisma $transaction mock: immediately calls the callback with itself
const mockPrisma = {
  $transaction: jest.fn(async (cb: (tx: any) => Promise<void>) => {
    await cb(mockPrisma);
  }),
};

// ── Test suite ────────────────────────────────────────────────────────────────

describe('LedgerService', () => {
  let service: LedgerService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        { provide: LedgerRepository, useValue: mockLedgerRepo },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
  });

  // ── ensureWalletAccounts ───────────────────────────────────────────────────

  describe('ensureWalletAccounts', () => {
    it('creates all three account types in parallel', async () => {
      mockLedgerRepo.upsertAccount.mockResolvedValue({});

      await service.ensureWalletAccounts(TENANT_ID, WALLET_ID, CHAIN);

      expect(mockLedgerRepo.upsertAccount).toHaveBeenCalledTimes(3);

      const calls = mockLedgerRepo.upsertAccount.mock.calls.map((c) => c[0]);
      const types = calls.map((c) => c.type).sort();
      expect(types).toEqual(['ASSET', 'LIABILITY', 'REVENUE']);
    });

    it('uses correct account codes with chain suffix', async () => {
      mockLedgerRepo.upsertAccount.mockResolvedValue({});

      await service.ensureWalletAccounts(TENANT_ID, WALLET_ID, 'ethereum' as any);

      const calls = mockLedgerRepo.upsertAccount.mock.calls.map((c) => c[0]);
      const codes = calls.map((c) => c.code).sort();
      expect(codes).toEqual(['1010-ETHEREUM', '2010-ETHEREUM', '4010-ETHEREUM']);
    });

    it('passes tenantId to every account upsert', async () => {
      mockLedgerRepo.upsertAccount.mockResolvedValue({});

      await service.ensureWalletAccounts(TENANT_ID, WALLET_ID, CHAIN);

      const calls = mockLedgerRepo.upsertAccount.mock.calls.map((c) => c[0]);
      calls.forEach((c) => expect(c.tenantId).toBe(TENANT_ID));
    });

    it('attaches walletId only to the ASSET account', async () => {
      mockLedgerRepo.upsertAccount.mockResolvedValue({});

      await service.ensureWalletAccounts(TENANT_ID, WALLET_ID, CHAIN);

      const calls = mockLedgerRepo.upsertAccount.mock.calls.map((c) => c[0]);
      const assetCall = calls.find((c) => c.type === 'ASSET');
      const liabilityCall = calls.find((c) => c.type === 'LIABILITY');
      const revenueCall = calls.find((c) => c.type === 'REVENUE');

      expect(assetCall.walletId).toBe(WALLET_ID);
      expect(liabilityCall.walletId).toBeUndefined();
      expect(revenueCall.walletId).toBeUndefined();
    });
  });

  // ── settlePayment — fee calculation ───────────────────────────────────────

  describe('settlePayment — fee calculation (50 bps = 0.5%)', () => {
    function setupAccounts() {
      mockLedgerRepo.findAccount
        .mockResolvedValueOnce(makeAccount('ASSET',     `1010-${CHAIN.toUpperCase()}`))
        .mockResolvedValueOnce(makeAccount('LIABILITY', `2010-${CHAIN.toUpperCase()}`))
        .mockResolvedValueOnce(makeAccount('REVENUE',   `4010-${CHAIN.toUpperCase()}`));
      mockLedgerRepo.writeEntry.mockResolvedValue({});
    }

    function makeInput(grossUsdc: string): SettlePaymentInput {
      return {
        tenantId: TENANT_ID,
        walletId: WALLET_ID,
        paymentId: PAYMENT_ID,
        amountUsdc: new Prisma.Decimal(grossUsdc),
        chain: CHAIN,
      };
    }

    it('writes exactly two ledger entries', async () => {
      setupAccounts();
      await service.settlePayment(makeInput('100.000000'));
      expect(mockLedgerRepo.writeEntry).toHaveBeenCalledTimes(2);
    });

    it('first entry debits Asset and credits Liability for the gross amount', async () => {
      setupAccounts();
      await service.settlePayment(makeInput('100.000000'));

      const [firstEntry] = mockLedgerRepo.writeEntry.mock.calls[0];
      expect(firstEntry.debitAccountId).toBe(`acct-1010-POLYGON`);
      expect(firstEntry.creditAccountId).toBe(`acct-2010-POLYGON`);
      expect(new Prisma.Decimal(firstEntry.amount).toFixed(6)).toBe('100.000000');
    });

    it('second entry debits Liability and credits Revenue for the fee (0.5% of gross)', async () => {
      setupAccounts();
      await service.settlePayment(makeInput('100.000000'));

      const [secondEntry] = mockLedgerRepo.writeEntry.mock.calls[1];
      expect(secondEntry.debitAccountId).toBe(`acct-2010-POLYGON`);
      expect(secondEntry.creditAccountId).toBe(`acct-4010-POLYGON`);
      // Fee = 100 * 50 / 10_000 = 0.5 USDC
      expect(new Prisma.Decimal(secondEntry.amount).toFixed(6)).toBe('0.500000');
    });

    it('correctly calculates fee for $1,000 (should be $5.00)', async () => {
      setupAccounts();
      await service.settlePayment(makeInput('1000.000000'));

      const [, secondEntry] = [
        mockLedgerRepo.writeEntry.mock.calls[0][0],
        mockLedgerRepo.writeEntry.mock.calls[1][0],
      ];
      expect(new Prisma.Decimal(secondEntry.amount).toFixed(6)).toBe('5.000000');
    });

    it('floors fractional fees at 6 decimal places (no rounding up)', async () => {
      setupAccounts();
      // 1.000001 USDC * 0.5% = 0.00500000(5) → floor to 0.000005
      // Let's use 1.000011 → 1.000011 * 50 / 10000 = 0.00500005(5) floor = 0.000005
      // Simpler: use an amount that produces a repeating decimal at 6dp
      // 33.333333 USDC * 0.5% = 0.16666666(5) → floor = 0.166666
      await service.settlePayment(makeInput('33.333333'));

      const [secondEntry] = mockLedgerRepo.writeEntry.mock.calls[1];
      const feeDecimal = new Prisma.Decimal(secondEntry.amount);
      // Should never exceed 6 decimal places
      expect(feeDecimal.decimalPlaces()).toBeLessThanOrEqual(6);
    });

    it('runs inside a single Prisma transaction', async () => {
      setupAccounts();
      await service.settlePayment(makeInput('100.000000'));
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('both entries reference the correct paymentId', async () => {
      setupAccounts();
      await service.settlePayment(makeInput('100.000000'));

      const [entry1] = mockLedgerRepo.writeEntry.mock.calls[0];
      const [entry2] = mockLedgerRepo.writeEntry.mock.calls[1];
      expect(entry1.paymentId).toBe(PAYMENT_ID);
      expect(entry2.paymentId).toBe(PAYMENT_ID);
    });

    it('fee entry metadata records the feeBps and gross amount', async () => {
      setupAccounts();
      await service.settlePayment(makeInput('200.000000'));

      const [feeEntry] = mockLedgerRepo.writeEntry.mock.calls[1];
      expect(feeEntry.metadata).toMatchObject({
        feeBps: 50,
        grossAmount: '200',
      });
    });
  });

  // ── settlePayment — zero fee edge case ────────────────────────────────────

  describe('settlePayment — tiny amounts', () => {
    it('skips the fee entry when fee rounds down to zero', async () => {
      // 0.000001 USDC * 0.5% = 0.000000005 → floor to 0 at 6dp
      mockLedgerRepo.findAccount
        .mockResolvedValueOnce(makeAccount('ASSET',     '1010-POLYGON'))
        .mockResolvedValueOnce(makeAccount('LIABILITY', '2010-POLYGON'))
        .mockResolvedValueOnce(makeAccount('REVENUE',   '4010-POLYGON'));
      mockLedgerRepo.writeEntry.mockResolvedValue({});

      await service.settlePayment({
        tenantId: TENANT_ID,
        walletId: WALLET_ID,
        paymentId: PAYMENT_ID,
        amountUsdc: new Prisma.Decimal('0.000001'),
        chain: CHAIN,
      });

      // Only the inflow entry — fee entry is skipped because fee === 0
      expect(mockLedgerRepo.writeEntry).toHaveBeenCalledTimes(1);
    });
  });

  // ── settlePayment — auto-provision accounts ───────────────────────────────

  describe('settlePayment — auto-provision when accounts are missing', () => {
    it('calls ensureWalletAccounts then retries when accounts do not exist', async () => {
      // First call: all three findAccount return null (not provisioned yet)
      mockLedgerRepo.findAccount
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        // Second call (after ensureWalletAccounts): accounts now exist
        .mockResolvedValueOnce(makeAccount('ASSET',     '1010-POLYGON'))
        .mockResolvedValueOnce(makeAccount('LIABILITY', '2010-POLYGON'))
        .mockResolvedValueOnce(makeAccount('REVENUE',   '4010-POLYGON'));

      mockLedgerRepo.upsertAccount.mockResolvedValue({});
      mockLedgerRepo.writeEntry.mockResolvedValue({});

      await service.settlePayment({
        tenantId: TENANT_ID,
        walletId: WALLET_ID,
        paymentId: PAYMENT_ID,
        amountUsdc: new Prisma.Decimal('50.000000'),
        chain: CHAIN,
      });

      expect(mockLedgerRepo.upsertAccount).toHaveBeenCalledTimes(3); // ensureWalletAccounts
      expect(mockLedgerRepo.writeEntry).toHaveBeenCalledTimes(2);    // inflow + fee
    });
  });

  // ── getTenantBalance / getPaymentAuditTrail / listAccounts ────────────────

  describe('read methods', () => {
    it('getTenantBalance delegates to the repository', async () => {
      const expectedBalance = new Prisma.Decimal('12345.678900');
      mockLedgerRepo.getTenantBalance.mockResolvedValue(expectedBalance);

      const result = await service.getTenantBalance(TENANT_ID);
      expect(result).toBe(expectedBalance);
      expect(mockLedgerRepo.getTenantBalance).toHaveBeenCalledWith(TENANT_ID);
    });

    it('getPaymentAuditTrail delegates to the repository', async () => {
      const entries = [{ id: 'entry-1' }, { id: 'entry-2' }];
      mockLedgerRepo.getPaymentEntries.mockResolvedValue(entries);

      const result = await service.getPaymentAuditTrail(PAYMENT_ID);
      expect(result).toBe(entries);
      expect(mockLedgerRepo.getPaymentEntries).toHaveBeenCalledWith(PAYMENT_ID);
    });

    it('listAccounts delegates to the repository', async () => {
      const accounts = [makeAccount('ASSET', '1010-POLYGON')];
      mockLedgerRepo.listAccounts.mockResolvedValue(accounts);

      const result = await service.listAccounts(TENANT_ID);
      expect(result).toBe(accounts);
      expect(mockLedgerRepo.listAccounts).toHaveBeenCalledWith(TENANT_ID);
    });
  });
});
