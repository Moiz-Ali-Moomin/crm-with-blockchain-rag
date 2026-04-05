import { z } from 'zod';
import { PaginationSchema } from '../../common/dto/pagination.dto';

export const CreateCompanySchema = z.object({
  name: z.string().min(1).max(255),
  industry: z.string().max(100).optional(),
  website: z.string().url().optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  employeeCount: z.number().int().nonnegative().optional(),
  annualRevenue: z.number().nonnegative().optional(),
  description: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.unknown()).default({}),
});

export const UpdateCompanySchema = CreateCompanySchema.partial();

export const FilterCompanySchema = PaginationSchema.extend({
  industry: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  minEmployeeCount: z.coerce.number().int().optional(),
  maxEmployeeCount: z.coerce.number().int().optional(),
  tags: z.string().optional(), // comma-separated
});

export type CreateCompanyDto = z.infer<typeof CreateCompanySchema>;
export type UpdateCompanyDto = z.infer<typeof UpdateCompanySchema>;
export type FilterCompanyDto = z.infer<typeof FilterCompanySchema>;
