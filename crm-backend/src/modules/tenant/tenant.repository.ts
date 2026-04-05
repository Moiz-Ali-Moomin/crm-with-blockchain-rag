/**
 * Tenant Repository
 *
 * Prisma queries for Tenant model.
 * Uses prisma.withoutTenantScope() because Tenant is excluded from auto-scoping.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class TenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.withoutTenantScope(() =>
      this.prisma.tenant.findUnique({ where: { id } }),
    );
  }

  async update(id: string, data: { name?: string; domain?: string | null }) {
    return this.prisma.withoutTenantScope(() =>
      this.prisma.tenant.update({ where: { id }, data }),
    );
  }

  async updateSettings(id: string, settings: Record<string, unknown>) {
    return this.prisma.withoutTenantScope(() =>
      this.prisma.tenant.update({ where: { id }, data: { settings: settings as any } }),
    );
  }

  async getTenantStats(tenantId: string) {
    const [totalUsers, totalLeads, totalContacts, totalDeals, totalCompanies] =
      await Promise.all([
        this.prisma.user.count({ where: { tenantId } }),
        this.prisma.lead.count({ where: { tenantId } }),
        this.prisma.contact.count({ where: { tenantId } }),
        this.prisma.deal.count({ where: { tenantId } }),
        this.prisma.company.count({ where: { tenantId } }),
      ]);

    return {
      totalUsers,
      totalLeads,
      totalContacts,
      totalDeals,
      totalCompanies,
    };
  }
}
