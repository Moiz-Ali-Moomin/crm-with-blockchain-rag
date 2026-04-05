import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class BlockchainRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(data: {
    tenantId: string;
    entityType: string;
    entityId: string;
    dataHash: string;
    network: string;
  }) {
    return this.prisma.withoutTenantScope(() =>
      this.prisma.blockchainRecord.upsert({
        where: {
          tenantId_entityType_entityId: {
            tenantId: data.tenantId,
            entityType: data.entityType,
            entityId: data.entityId,
          },
        },
        create: { ...data, status: 'PENDING' },
        update: { dataHash: data.dataHash, status: 'PENDING', updatedAt: new Date() },
      }),
    );
  }

  async confirm(
    id: string,
    txHash: string,
    blockNumber: bigint,
    gasUsed: string,
  ) {
    return this.prisma.withoutTenantScope(() =>
      this.prisma.blockchainRecord.update({
        where: { id },
        data: { status: 'CONFIRMED', txHash, blockNumber, gasUsed, updatedAt: new Date() },
      }),
    );
  }

  async fail(id: string, error: string) {
    return this.prisma.withoutTenantScope(() =>
      this.prisma.blockchainRecord.update({
        where: { id },
        data: { status: 'FAILED', error, updatedAt: new Date() },
      }),
    );
  }

  async findByDeal(tenantId: string, entityId: string) {
    return this.prisma.blockchainRecord.findFirst({
      where: { tenantId, entityType: 'DEAL', entityId },
    });
  }
}
