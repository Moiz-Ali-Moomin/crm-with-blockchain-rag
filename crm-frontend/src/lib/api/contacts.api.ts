import { apiGet, apiPost, apiDelete, apiPatch, apiGetPaginated, PaginatedResult } from './client';
import { Contact } from '@/types';

export interface ContactFilters {
  page?: number;
  limit?: number;
  companyId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateContactDto {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  companyId?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  timezone?: string;
  notes?: string;
  tags?: string[];
}

export const contactsApi = {
  getAll: (filters?: ContactFilters): Promise<PaginatedResult<Contact>> =>
    apiGetPaginated<Contact>('/contacts', filters),

  getById: (id: string): Promise<Contact> =>
    apiGet<Contact>(`/contacts/${id}`),

  create: (data: CreateContactDto): Promise<Contact> =>
    apiPost<Contact>('/contacts', data),

  update: (id: string, data: Partial<CreateContactDto>): Promise<Contact> =>
    apiPatch<Contact>(`/contacts/${id}`, data),

  delete: (id: string): Promise<void> =>
    apiDelete<void>(`/contacts/${id}`),
};
