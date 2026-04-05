import { z } from 'zod';

export const ListNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z
    .string()
    .transform((v) => v === 'true')
    .pipe(z.boolean())
    .optional(),
});

export const CreateNotificationSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().min(1),
  type: z.string(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});

export type ListNotificationsQueryDto = z.infer<typeof ListNotificationsQuerySchema>;
export type CreateNotificationDto = z.infer<typeof CreateNotificationSchema>;
