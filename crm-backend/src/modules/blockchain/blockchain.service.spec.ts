import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BlockchainService, DealPayloadForHash } from './blockchain.service';
import { BlockchainRepository } from './blockchain.repository';

// ── Shared test fixtures ─────────────────────────────────────────────────────

const SAMPLE_PAYLOAD: DealPayloadForHash = {
  tenantId: 'tenant-abc',
  dealId: 'deal-123',
  title: 'Enterprise SaaS Deal',
  value: '25000.00',
  currency: 'USD',
  wonAt: '2024-06-01T00:00:00.000Z',
  ownerId: 'user-xyz',
  pipelineId: 'pipe-001',
};

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockBlockchainRepo = {
  fail: jest.fn(),
  confirm: jest.fn(),
  findByDeal: jest.fn(),
  upsert: jest.fn(),
};

function makeConfigService(overrides: Record<string, string | undefined> = {}) {
  const defaults: Record<string, string | undefined> = {
    BLOCKCHAIN_RPC_URL: 'https://rpc.example.com',
    BLOCKCHAIN_PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    BLOCKCHAIN_CONTRACT_ADDR: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    BLOCKCHAIN_NETWORK: 'polygon-mumbai',
    ...overrides,
  };
  return {
    get: (key: string, fallback?: string) => defaults[key] ?? fallback,
    getOrThrow: (key: string) => {
      if (!defaults[key]) throw new Error(`Missing ${key}`);
      return defaults[key];
    },
  };
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('BlockchainService', () => {
  let service: BlockchainService;

  async function buildModule(configOverrides: Record<string, string | undefined> = {}) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainService,
        { provide: ConfigService, useValue: makeConfigService(configOverrides) },
        { provide: BlockchainRepository, useValue: mockBlockchainRepo },
      ],
    }).compile();

    return module.get<BlockchainService>(BlockchainService);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await buildModule();
  });

  // ── computeDealHash ────────────────────────────────────────────────────────

  describe('computeDealHash', () => {
    it('returns a 0x-prefixed 32-byte hex string', () => {
      const hash = service.computeDealHash(SAMPLE_PAYLOAD);
      expect(hash).toMatch(/^0x[0-9a-f]{64}$/i);
    });

    it('is deterministic — identical payloads produce the same hash', () => {
      const h1 = service.computeDealHash(SAMPLE_PAYLOAD);
      const h2 = service.computeDealHash({ ...SAMPLE_PAYLOAD });
      expect(h1).toBe(h2);
    });

    it('produces different hashes when any field differs', () => {
      const base = service.computeDealHash(SAMPLE_PAYLOAD);
      expect(service.computeDealHash({ ...SAMPLE_PAYLOAD, title: 'Other Deal' })).not.toBe(base);
      expect(service.computeDealHash({ ...SAMPLE_PAYLOAD, value: '1.00' })).not.toBe(base);
      expect(service.computeDealHash({ ...SAMPLE_PAYLOAD, tenantId: 'other-tenant' })).not.toBe(base);
      expect(service.computeDealHash({ ...SAMPLE_PAYLOAD, dealId: 'deal-999' })).not.toBe(base);
      expect(service.computeDealHash({ ...SAMPLE_PAYLOAD, currency: 'EUR' })).not.toBe(base);
      expect(service.computeDealHash({ ...SAMPLE_PAYLOAD, wonAt: '2025-01-01T00:00:00.000Z' })).not.toBe(base);
      expect(service.computeDealHash({ ...SAMPLE_PAYLOAD, ownerId: 'user-other' })).not.toBe(base);
    });

    it('treats null ownerId the same as empty string (lossless encoding)', () => {
      const withNull = service.computeDealHash({ ...SAMPLE_PAYLOAD, ownerId: null });
      const withEmpty = service.computeDealHash({ ...SAMPLE_PAYLOAD, ownerId: '' });
      // Both encode ownerId as '' — must produce the same hash
      expect(withNull).toBe(withEmpty);
    });

    it('null ownerId hash differs from a real ownerId', () => {
      const withNull = service.computeDealHash({ ...SAMPLE_PAYLOAD, ownerId: null });
      const withUser = service.computeDealHash({ ...SAMPLE_PAYLOAD, ownerId: 'user-xyz' });
      expect(withNull).not.toBe(withUser);
    });

    it('order of fields in payload object does not affect the hash', () => {
      // JavaScript object ordering should be irrelevant — ABI encoding uses fixed positions
      const { tenantId, dealId, title, value, currency, wonAt, ownerId, pipelineId } = SAMPLE_PAYLOAD;
      const reordered: DealPayloadForHash = { pipelineId, ownerId, wonAt, currency, value, title, dealId, tenantId };
      expect(service.computeDealHash(reordered)).toBe(service.computeDealHash(SAMPLE_PAYLOAD));
    });
  });

  // ── network property ────────────────────────────────────────────────────────

  describe('network', () => {
    it('reads BLOCKCHAIN_NETWORK from config', () => {
      expect(service.network).toBe('polygon-mumbai');
    });

    it('falls back to "polygon-mumbai" when env var is absent', async () => {
      const svc = await buildModule({ BLOCKCHAIN_NETWORK: undefined });
      expect(svc.network).toBe('polygon-mumbai');
    });
  });

  // ── registerOnChain — missing env vars ─────────────────────────────────────

  describe('registerOnChain — missing env vars', () => {
    it('calls repo.fail and returns early when BLOCKCHAIN_RPC_URL is missing', async () => {
      const svc = await buildModule({ BLOCKCHAIN_RPC_URL: undefined });
      await svc.registerOnChain('record-1', 'tenant-abc', 'deal-123', '0xdeadbeef');
      expect(mockBlockchainRepo.fail).toHaveBeenCalledTimes(1);
      expect(mockBlockchainRepo.fail).toHaveBeenCalledWith(
        'record-1',
        expect.stringContaining('missing env vars'),
      );
    });

    it('calls repo.fail when BLOCKCHAIN_PRIVATE_KEY is missing', async () => {
      const svc = await buildModule({ BLOCKCHAIN_PRIVATE_KEY: undefined });
      await svc.registerOnChain('record-2', 'tenant-abc', 'deal-123', '0xdeadbeef');
      expect(mockBlockchainRepo.fail).toHaveBeenCalledTimes(1);
    });

    it('calls repo.fail when BLOCKCHAIN_CONTRACT_ADDR is missing', async () => {
      const svc = await buildModule({ BLOCKCHAIN_CONTRACT_ADDR: undefined });
      await svc.registerOnChain('record-3', 'tenant-abc', 'deal-123', '0xdeadbeef');
      expect(mockBlockchainRepo.fail).toHaveBeenCalledTimes(1);
    });

    it('does NOT throw — silently degrades to FAILED status', async () => {
      const svc = await buildModule({ BLOCKCHAIN_RPC_URL: undefined });
      await expect(
        svc.registerOnChain('record-1', 'tenant-abc', 'deal-123', '0xdeadbeef'),
      ).resolves.toBeUndefined();
    });
  });

  // ── registerOnChain — happy path ────────────────────────────────────────────

  describe('registerOnChain — on-chain success', () => {
    it('calls repo.confirm with tx hash, block number, and gas used on success', async () => {
      // Build a fake contract that resolves successfully
      const fakeTx = {
        hash: '0xabc123',
        wait: jest.fn().mockResolvedValue({
          status: 1,
          blockNumber: 42_000_000,
          gasUsed: BigInt(50_000),
        }),
      };

      // Inject the contract directly to avoid live RPC connection
      (service as any)._writeContract = {
        registerDeal: jest.fn().mockResolvedValue(fakeTx),
      };

      await service.registerOnChain('record-ok', 'tenant-abc', 'deal-123', '0x' + 'a'.repeat(64));

      expect(mockBlockchainRepo.confirm).toHaveBeenCalledWith(
        'record-ok',
        '0xabc123',
        BigInt(42_000_000),
        '50000',
      );
      expect(mockBlockchainRepo.fail).not.toHaveBeenCalled();
    });

    it('throws when the transaction is reverted (status !== 1)', async () => {
      const fakeTx = {
        hash: '0xreverted',
        wait: jest.fn().mockResolvedValue({ status: 0, blockNumber: 1, gasUsed: BigInt(21000) }),
      };

      (service as any)._writeContract = {
        registerDeal: jest.fn().mockResolvedValue(fakeTx),
      };

      await expect(
        service.registerOnChain('record-rev', 'tenant-abc', 'deal-123', '0x' + 'b'.repeat(64)),
      ).rejects.toThrow(/Transaction reverted/);
    });

    it('throws when tx.wait() returns null receipt', async () => {
      const fakeTx = {
        hash: '0xdropped',
        wait: jest.fn().mockResolvedValue(null),
      };

      (service as any)._writeContract = {
        registerDeal: jest.fn().mockResolvedValue(fakeTx),
      };

      await expect(
        service.registerOnChain('record-null', 'tenant-abc', 'deal-123', '0x' + 'c'.repeat(64)),
      ).rejects.toThrow();
    });
  });

  // ── verifyDealOnChain ──────────────────────────────────────────────────────

  describe('verifyDealOnChain', () => {
    it('returns isValid=false when no DB record exists', async () => {
      mockBlockchainRepo.findByDeal.mockResolvedValue(null);
      const result = await service.verifyDealOnChain('tenant-abc', 'deal-000');
      expect(result.isValid).toBe(false);
      expect(result.storedHash).toBe('');
      expect(result.network).toBe('polygon-mumbai');
    });

    it('returns isValid=false when record status is PENDING', async () => {
      mockBlockchainRepo.findByDeal.mockResolvedValue({
        status: 'PENDING',
        dataHash: '0x' + 'a'.repeat(64),
        txHash: null,
        createdAt: new Date(),
        blockNumber: null,
      });
      const result = await service.verifyDealOnChain('tenant-abc', 'deal-pending');
      expect(result.isValid).toBe(false);
    });

    it('returns isValid=true from DB state alone when read contract is unavailable', async () => {
      const svc = await buildModule({ BLOCKCHAIN_RPC_URL: undefined });
      mockBlockchainRepo.findByDeal.mockResolvedValue({
        status: 'CONFIRMED',
        dataHash: '0x' + 'f'.repeat(64),
        txHash: '0xconfirmedtx',
        createdAt: new Date('2024-01-01'),
        blockNumber: BigInt(99_000_000),
      });
      const result = await svc.verifyDealOnChain('tenant-abc', 'deal-confirmed');
      expect(result.isValid).toBe(true);
      expect(result.storedHash).toBe('0x' + 'f'.repeat(64));
      expect(result.txHash).toBe('0xconfirmedtx');
    });

    it('returns isValid=true when on-chain hash matches DB hash', async () => {
      const hash = '0x' + 'a'.repeat(64);
      mockBlockchainRepo.findByDeal.mockResolvedValue({
        status: 'CONFIRMED',
        dataHash: hash,
        txHash: '0xontx',
        createdAt: new Date('2024-01-01'),
        blockNumber: BigInt(100),
      });

      // Inject a fake read contract that returns the matching hash
      (service as any)._readContract = {
        getDealRecord: jest.fn().mockResolvedValue([hash, BigInt(1704067200), BigInt(100)]),
      };

      const result = await service.verifyDealOnChain('tenant-abc', 'deal-verified');
      expect(result.isValid).toBe(true);
      expect(result.blockNumber).toBe(100);
    });

    it('returns isValid=false when on-chain hash does not match DB', async () => {
      const dbHash = '0x' + 'a'.repeat(64);
      const onChainHash = '0x' + 'b'.repeat(64); // tampered
      mockBlockchainRepo.findByDeal.mockResolvedValue({
        status: 'CONFIRMED',
        dataHash: dbHash,
        txHash: '0xontx',
        createdAt: new Date(),
        blockNumber: BigInt(100),
      });

      (service as any)._readContract = {
        getDealRecord: jest.fn().mockResolvedValue([onChainHash, BigInt(1704067200), BigInt(100)]),
      };

      const result = await service.verifyDealOnChain('tenant-abc', 'deal-tampered');
      expect(result.isValid).toBe(false);
    });

    it('returns isValid=false when on-chain record is zero hash (not registered)', async () => {
      const ZERO_HASH = '0x' + '0'.repeat(64);
      mockBlockchainRepo.findByDeal.mockResolvedValue({
        status: 'CONFIRMED',
        dataHash: '0x' + 'a'.repeat(64),
        txHash: '0xontx',
        createdAt: new Date(),
        blockNumber: BigInt(100),
      });

      (service as any)._readContract = {
        getDealRecord: jest.fn().mockResolvedValue([ZERO_HASH, BigInt(0), BigInt(0)]),
      };

      const result = await service.verifyDealOnChain('tenant-abc', 'deal-unregistered');
      expect(result.isValid).toBe(false);
    });
  });

  // ── Contract lazy-init reuse ───────────────────────────────────────────────

  describe('lazy contract initialisation', () => {
    it('reuses the write contract instance across calls', async () => {
      const fakeTx = {
        hash: '0xtx1',
        wait: jest.fn().mockResolvedValue({ status: 1, blockNumber: 1, gasUsed: BigInt(21000) }),
      };
      const fakeContract = { registerDeal: jest.fn().mockResolvedValue(fakeTx) };
      (service as any)._writeContract = fakeContract;

      await service.registerOnChain('r1', 'tenant', 'deal1', '0x' + 'a'.repeat(64));
      await service.registerOnChain('r2', 'tenant', 'deal2', '0x' + 'b'.repeat(64));

      // registerDeal called twice on the SAME contract object
      expect(fakeContract.registerDeal).toHaveBeenCalledTimes(2);
    });
  });
});
