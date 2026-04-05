import { apiGet, apiPost, apiDelete, apiPatch, apiGetPaginated, PaginatedResult } from './client';
import { Lead } from '@/types';

export interface LeadFilters {
  page?: number;
  limit?: number;
  status?: string;
  source?: string;
  assigneeId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateLeadDto {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  companyName?: string;
  status?: string;
  source?: string;
  score?: number;
  assigneeId?: string;
  tags?: string[];
  notes?: string;
}

export interface ConvertLeadDto {
  createContact?: boolean;
  createCompany?: boolean;
  createDeal?: boolean;
  dealTitle?: string;
  dealValue?: number;
  pipelineId?: string;
  stageId?: string;
}

export const leadsApi = {
  getAll: (filters?: LeadFilters): Promise<PaginatedResult<Lead>> =>
    apiGetPaginated<Lead>('/leads', filters),

  getById: (id: string): Promise<Lead> =>
    apiGet<Lead>(`/leads/${id}`),

  create: (data: CreateLeadDto): Promise<Lead> =>
    apiPost<Lead>('/leads', data),

  update: (id: string, data: Partial<CreateLeadDto>): Promise<Lead> =>
    apiPatch<Lead>(`/leads/${id}`, data),

  delete: (id: string): Promise<void> =>
    apiDelete<void>(`/leads/${id}`),

  assign: (id: string, assigneeId: string): Promise<Lead> =>
    apiPatch<Lead>(`/leads/${id}/assign`, { assigneeId }),

  convert: (id: string, data: ConvertLeadDto): Promise<unknown> =>
    apiPost(`/leads/${id}/convert`, data),

  bulkAssign: (ids: string[], assigneeId: string): Promise<void> =>
    apiPost<void>('/leads/bulk-assign', { ids, assigneeId }),

  bulkDelete: (ids: string[]): Promise<void> =>
    apiPost<void>('/leads/bulk-delete', { ids }),

  addTag: (id: string, tag: string): Promise<Lead> =>
    apiPatch<Lead>(`/leads/${id}/tags`, { action: 'add', tag }),

  removeTag: (id: string, tag: string): Promise<Lead> =>
    apiPatch<Lead>(`/leads/${id}/tags`, { action: 'remove', tag }),

  updateScore: (id: string, score: number): Promise<Lead> =>
    apiPatch<Lead>(`/leads/${id}/score`, { score }),
};
