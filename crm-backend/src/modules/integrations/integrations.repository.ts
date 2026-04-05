/**
 * Integrations Repository
 *
 * Prisma queries only — no business logic.
 * tenantId is auto-injected via Prisma middleware from AsyncLocalStorage.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { IntegrationType } from '@prisma/client';

@Injectable()
export class IntegrationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.integration.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByType(type: IntegrationType) {
    return this.prisma.integration.findFirst({ where: { type } });
  }

  async upsert(
    tenantId: string,
    type: IntegrationType,
    data: {
      name?: string;
      isActive?: boolean;
      credentials?: Record<string, unknown>;
      settings?: Record<string, unknown>;
    },
  ) {
    return this.prisma.integration.upsert({
      where: { tenantId_type: { tenantId, type } },
      create: {
        tenantId,
        type,
        name: data.name ?? type.toLowerCase(),
        isActive: data.isActive ?? true,
        credentials: (data.credentials ?? {}) as any,
        settings: (data.settings ?? {}) as any,
      },
      update: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.credentials !== undefined && { credentials: data.credentials as any }),
        ...(data.settings !== undefined && { settings: data.settings as any }),
        updatedAt: new Date(),
      },
    });
  }

  async update(tenantId: string, type: IntegrationType, data: {
    name?: string;
    isActive?: boolean;
    credentials?: Record<string, unknown>;
    settings?: Record<string, unknown>;
  }) {
    return this.prisma.integration.update({
      where: { tenantId_type: { tenantId, type } },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.credentials !== undefined && { credentials: data.credentials as any }),
        ...(data.settings !== undefined && { settings: data.settings as any }),
        updatedAt: new Date(),
      },
    });
  }
}
