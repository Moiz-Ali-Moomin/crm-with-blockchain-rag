/**
 * Billing DTOs
 * Zod schemas for billing and subscription operations
 */

import { z } from 'zod';

export const CreateCheckoutSessionSchema = z.object({
  planId: z.enum(['free', 'starter', 'pro', 'enterprise']),
  successUrl: z.string().url('Must be a valid success URL'),
  returnUrl: z.string().url('Must be a valid return URL'),
});

export type CreateCheckoutSessionDto = z.infer<typeof CreateCheckoutSessionSchema>;
