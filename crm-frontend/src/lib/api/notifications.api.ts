import { apiGet, apiPatch, apiDelete } from './client';
import type { Notification, PaginatedData } from '@/types';

export const notificationsApi = {
  getAll: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    apiGet<PaginatedData<Notification>>('/notifications', params),

  getUnreadCount: () =>
    apiGet<{ count: number }>('/notifications/unread-count'),

  markRead: (id: string) =>
    apiPatch<Notification>(`/notifications/${id}/read`, {}),

  markAllRead: () => apiPatch<{ updated: number }>('/notifications/read-all', {}),

  delete: (id: string) =>
    apiDelete<{ deleted: boolean }>(`/notifications/${id}`),
};
