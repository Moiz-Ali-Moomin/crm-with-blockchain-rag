/**
 * Tenant DTOs
 * Zod schemas for tenant management operations
 */

import { z } from 'zod';

export const UpdateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  domain: z.string().optional().nullable(),
});

export const UpdateTenantSettingsSchema = z.object({
  logoUrl: z.string().url().optional().nullable(),
  timezone: z.string().optional(),
  dateFormat: z.string().optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  notificationPreferences: z.record(z.unknown()).optional(),
});

export type UpdateTenantDto = z.infer<typeof UpdateTenantSchema>;
export type UpdateTenantSettingsDto = z.infer<typeof UpdateTenantSettingsSchema>;
