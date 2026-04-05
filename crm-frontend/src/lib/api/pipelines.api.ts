import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './client';
import type { Pipeline, Stage } from '@/types';

export const pipelinesApi = {
  getAll: () => apiGet<Pipeline[]>('/pipelines'),

  getById: (id: string) => apiGet<Pipeline>(`/pipelines/${id}`),

  getDefault: () => apiGet<Pipeline>('/pipelines/default'),

  create: (data: { name: string; isDefault?: boolean }) =>
    apiPost<Pipeline>('/pipelines', data),

  update: (id: string, data: object) => apiPut<Pipeline>(`/pipelines/${id}`, data),

  delete: (id: string) => apiDelete<{ deleted: boolean }>(`/pipelines/${id}`),

  createStage: (pipelineId: string, data: object) =>
    apiPost<Stage>(`/pipelines/${pipelineId}/stages`, data),

  updateStage: (pipelineId: string, stageId: string, data: object) =>
    apiPut<Stage>(`/pipelines/${pipelineId}/stages/${stageId}`, data),

  deleteStage: (pipelineId: string, stageId: string) =>
    apiDelete<{ deleted: boolean }>(
      `/pipelines/${pipelineId}/stages/${stageId}`,
    ),

  reorderStages: (pipelineId: string, stageIds: string[]) =>
    apiPatch<Stage[]>(`/pipelines/${pipelineId}/stages/reorder`, { stageIds }),
};
