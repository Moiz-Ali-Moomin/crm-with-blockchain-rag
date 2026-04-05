import { z } from 'zod';
import { PaginationSchema } from '../../common/dto/pagination.dto';

export const CreateContactSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
  email:     z.string().email().optional(),
  phone:     z.string().max(30).optional(),
  jobTitle:  z.string().max(100).optional(),
  companyId: z.string().uuid().optional(),
  notes:     z.string().max(5000).optional(),
});

export const UpdateContactSchema = CreateContactSchema.partial();

export const ListContactsSchema = PaginationSchema.extend({
  search:    z.string().max(200).optional(),
  companyId: z.string().uuid().optional(),
});

export type CreateContactDto = z.infer<typeof CreateContactSchema>;
export type UpdateContactDto = z.infer<typeof UpdateContactSchema>;
export type ListContactsDto  = z.infer<typeof ListContactsSchema>;
