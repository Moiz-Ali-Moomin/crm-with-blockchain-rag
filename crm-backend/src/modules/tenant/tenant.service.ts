/**
 * Tenant Service
 *
 * Business logic for tenant profile management, settings, and statistics.
 * Deep-merges settings JSON to preserve existing keys on partial updates.
 */

import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../shared/errors/domain.errors';
import { TenantRepository } from './tenant.repository';
import { UpdateTenantDto, UpdateTenantSettingsDto } from './tenant.dto';

@Injectable()
export class TenantService {
  constructor(private readonly tenantRepo: TenantRepository) {}

  async getCurrent(tenantId: string) {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    // Exclude internal/sensitive fields before returning
    const { isActive: _isActive, ...safe } = tenant;
    return safe;
  }

  async update(tenantId: string, dto: UpdateTenantDto) {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    return this.tenantRepo.update(tenantId, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.domain !== undefined && { domain: dto.domain }),
    });
  }

  async updateSettings(tenantId: string, dto: UpdateTenantSettingsDto) {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    // Deep merge: preserve existing settings, overwrite only provided keys
    const existingSettings = (tenant.settings as Record<string, unknown>) ?? {};
    const mergedSettings: Record<string, unknown> = { ...existingSettings };

    if (dto.logoUrl !== undefined) mergedSettings.logoUrl = dto.logoUrl;
    if (dto.timezone !== undefined) mergedSettings.timezone = dto.timezone;
    if (dto.dateFormat !== undefined) mergedSettings.dateFormat = dto.dateFormat;
    if (dto.currency !== undefined) mergedSettings.currency = dto.currency;
    if (dto.notificationPreferences !== undefined) {
      const existingPrefs =
        (existingSettings.notificationPreferences as Record<string, unknown>) ?? {};
      mergedSettings.notificationPreferences = {
        ...existingPrefs,
        ...dto.notificationPreferences,
      };
    }

    return this.tenantRepo.updateSettings(tenantId, mergedSettings);
  }

  async getStats(tenantId: string) {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) throw new NotFoundError('Tenant', tenantId);

    return this.tenantRepo.getTenantStats(tenantId);
  }
}
