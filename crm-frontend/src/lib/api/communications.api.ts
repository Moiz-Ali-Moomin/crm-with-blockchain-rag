import { apiGet, apiPost } from './client';
import type { Communication, PaginatedData } from '@/types';

export const communicationsApi = {
  getAll: (filters?: object) =>
    apiGet<PaginatedData<Communication>>('/communications', filters),

  getById: (id: string) => apiGet<Communication>(`/communications/${id}`),

  getContactTimeline: (contactId: string, params?: object) =>
    apiGet<PaginatedData<Communication>>(
      `/communications/contact/${contactId}`,
      params,
    ),

  sendEmail: (data: {
    toAddr: string;
    subject: string;
    body?: string;
    templateId?: string;
    variables?: Record<string, unknown>;
    contactId?: string;
  }) => apiPost<Communication>('/communications/email', data),

  sendSms: (data: {
    toAddr: string;
    body: string;
    contactId?: string;
  }) => apiPost<Communication>('/communications/sms', data),
};
