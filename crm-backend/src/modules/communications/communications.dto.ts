import { z } from 'zod';
import { PaginationSchema } from '../../common/dto/pagination.dto';

export const SendEmailSchema = z.object({
  toAddr: z.string().email(),
  subject: z.string().min(1),
  body: z.string().optional(),
  templateId: z.string().uuid().optional(),
  variables: z.record(z.unknown()).default({}),
  contactId: z.string().uuid().optional(),
});

export const SendSmsSchema = z.object({
  toAddr: z.string().min(10),
  body: z.string().min(1).max(1600),
  contactId: z.string().uuid().optional(),
});

export const FilterCommunicationSchema = PaginationSchema.extend({
  contactId: z.string().uuid().optional(),
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PHONE']).optional(),
  direction: z.enum(['INBOUND', 'OUTBOUND']).optional(),
  status: z.enum(['QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'OPENED', 'CLICKED', 'BOUNCED']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export type SendEmailDto = z.infer<typeof SendEmailSchema>;
export type SendSmsDto = z.infer<typeof SendSmsSchema>;
export type FilterCommunicationDto = z.infer<typeof FilterCommunicationSchema>;
