/**
 * Webhooks DTOs
 * Zod schemas for webhook configuration and delivery operations
 */

import { z } from 'zod';
import { PaginationSchema } from '../../common/dto/pagination.dto';

export const WebhookEventEnum = z.enum([
  'LEAD_CREATED',
  'LEAD_UPDATED',
  'CONTACT_CREATED',
  'CONTACT_UPDATED',
  'DEAL_CREATED',
  'DEAL_UPDATED',
  'DEAL_WON',
  'DEAL_LOST',
  'TICKET_CREATED',
  'TICKET_UPDATED',
  'COMPANY_CREATED',
  'COMPANY_UPDATED',
]);

export const CreateWebhookSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  secret: z.string().min(8).optional(),
  events: z.array(WebhookEventEnum).min(1, 'At least one event must be selected'),
  isActive: z.boolean().default(true),
});

export const UpdateWebhookSchema = z.object({
  url: z.string().url('Must be a valid URL').optional(),
  secret: z.string().min(8).optional(),
  events: z.array(WebhookEventEnum).min(1).optional(),
  isActive: z.boolean().optional(),
});

export const WebhookQuerySchema = PaginationSchema;

export const DeliveryQuerySchema = PaginationSchema;

export type CreateWebhookDto = z.infer<typeof CreateWebhookSchema>;
export type UpdateWebhookDto = z.infer<typeof UpdateWebhookSchema>;
export type WebhookQueryDto = z.infer<typeof WebhookQuerySchema>;
export type DeliveryQueryDto = z.infer<typeof DeliveryQuerySchema>;
