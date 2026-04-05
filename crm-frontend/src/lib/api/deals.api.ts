import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import type { Deal, KanbanBoard, PaginatedData } from '@/types';

export const dealsApi = {
  getAll: (filters?: object) =>
    apiGet<PaginatedData<Deal>>('/deals', filters),

  getById: (id: string) => apiGet<Deal>(`/deals/${id}`),

  getKanban: (pipelineId: string) =>
    apiGet<KanbanBoard>(`/deals/kanban/${pipelineId}`),

  getForecast: (params?: object) =>
    apiGet<any>('/deals/forecast', params),

  create: (data: object) => apiPost<Deal>('/deals', data),

  update: (id: string, data: object) => apiPatch<Deal>(`/deals/${id}`, data),

  moveStage: (id: string, stageId: string) =>
    apiPatch<Deal>(`/deals/${id}/move-stage`, { stageId }),

  delete: (id: string) => apiDelete<{ deleted: boolean }>(`/deals/${id}`),
};
