/**
 * Integrations DTOs
 * Zod schemas for third-party integration management
 */

import { z } from 'zod';

export const IntegrationTypeEnum = z.enum([
  'STRIPE',
  'GOOGLE_ADS',
  'FACEBOOK_ADS',
  'ZAPIER',
  'SLACK',
  'CUSTOM',
]);

export const ConnectIntegrationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  credentials: z.record(z.unknown()).default({}),
  settings: z.record(z.unknown()).default({}),
});

export const UpdateIntegrationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export type ConnectIntegrationDto = z.infer<typeof ConnectIntegrationSchema>;
export type UpdateIntegrationDto = z.infer<typeof UpdateIntegrationSchema>;
export type IntegrationTypeValue = z.infer<typeof IntegrationTypeEnum>;
