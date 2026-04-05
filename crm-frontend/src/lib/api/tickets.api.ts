import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './client';
import type { Ticket, TicketReply, PaginatedData } from '@/types';

export const ticketsApi = {
  getAll: (filters?: object) =>
    apiGet<PaginatedData<Ticket>>('/tickets', filters),

  getById: (id: string) => apiGet<Ticket>(`/tickets/${id}`),

  create: (data: object) => apiPost<Ticket>('/tickets', data),

  update: (id: string, data: object) => apiPut<Ticket>(`/tickets/${id}`, data),

  assign: (id: string, assigneeId: string) =>
    apiPatch<Ticket>(`/tickets/${id}/assign`, { assigneeId }),

  delete: (id: string) => apiDelete<{ deleted: boolean }>(`/tickets/${id}`),

  addReply: (ticketId: string, data: { body: string; isInternal?: boolean }) =>
    apiPost<TicketReply>(`/tickets/${ticketId}/replies`, data),

  updateReply: (ticketId: string, replyId: string, data: { body: string }) =>
    apiPut<TicketReply>(`/tickets/${ticketId}/replies/${replyId}`, data),

  deleteReply: (ticketId: string, replyId: string) =>
    apiDelete<{ deleted: boolean }>(`/tickets/${ticketId}/replies/${replyId}`),
};
