import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import type { Task, PaginatedData } from '@/types';

export const tasksApi = {
  getAll: (filters?: object) =>
    apiGet<PaginatedData<Task>>('/tasks', filters),

  getById: (id: string) => apiGet<Task>(`/tasks/${id}`),

  getMyTasks: (params?: object) =>
    apiGet<PaginatedData<Task>>('/tasks/my-tasks', params),

  create: (data: object) => apiPost<Task>('/tasks', data),

  update: (id: string, data: object) => apiPatch<Task>(`/tasks/${id}`, data),

  complete: (id: string) => apiPatch<Task>(`/tasks/${id}/complete`, {}),

  delete: (id: string) => apiDelete<{ deleted: boolean }>(`/tasks/${id}`),
};
