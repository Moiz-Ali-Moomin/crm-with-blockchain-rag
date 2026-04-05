import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type { Activity, EntityType, PaginatedData } from '@/types';

export const activitiesApi = {
  getAll: (filters?: object) =>
    apiGet<PaginatedData<Activity>>('/activities', filters),

  getById: (id: string) => apiGet<Activity>(`/activities/${id}`),

  getTimeline: (
    entityType: EntityType,
    entityId: string,
    params?: { page?: number; limit?: number },
  ) =>
    apiGet<PaginatedData<Activity>>('/activities/timeline', {
      entityType,
      entityId,
      ...params,
    }),

  create: (data: object) => apiPost<Activity>('/activities', data),

  update: (id: string, data: object) =>
    apiPut<Activity>(`/activities/${id}`, data),

  delete: (id: string) => apiDelete<{ deleted: boolean }>(`/activities/${id}`),
};
