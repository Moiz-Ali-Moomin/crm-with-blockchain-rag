import { z } from 'zod';
import { PaginationSchema } from '../../common/dto/pagination.dto';

export const CreateEmailTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  subject: z.string().min(1),
  htmlBody: z.string().min(1),
  plainText: z.string().optional(),
  variables: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  category: z.string().optional(),
});

export const UpdateEmailTemplateSchema = CreateEmailTemplateSchema.partial();

export const FilterEmailTemplateSchema = PaginationSchema.extend({
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  category: z.string().optional(),
});

export const PreviewEmailTemplateSchema = z.object({
  variables: z.record(z.unknown()).default({}),
});

export type CreateEmailTemplateDto = z.infer<typeof CreateEmailTemplateSchema>;
export type UpdateEmailTemplateDto = z.infer<typeof UpdateEmailTemplateSchema>;
export type FilterEmailTemplateDto = z.infer<typeof FilterEmailTemplateSchema>;
export type PreviewEmailTemplateDto = z.infer<typeof PreviewEmailTemplateSchema>;
