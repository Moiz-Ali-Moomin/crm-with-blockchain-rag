import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type { Company, PaginatedData } from '@/types';

export const companiesApi = {
  getAll: (filters?: object) =>
    apiGet<PaginatedData<Company>>('/companies', filters),

  getById: (id: string) => apiGet<Company>(`/companies/${id}`),

  create: (data: object) => apiPost<Company>('/companies', data),

  update: (id: string, data: object) => apiPut<Company>(`/companies/${id}`, data),

  delete: (id: string) => apiDelete<{ deleted: boolean }>(`/companies/${id}`),
};
