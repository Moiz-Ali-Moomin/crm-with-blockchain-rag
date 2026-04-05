import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/client';
import type { Workflow, PaginatedData } from '@/types';

const KEYS = {
  all: ['workflows'] as const,
  list: () => ['workflows', 'list'] as const,
  detail: (id: string) => ['workflows', id] as const,
};

export function useWorkflows() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn: () => apiGet<PaginatedData<Workflow>>('/automation/workflows'),
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn: () => apiGet<Workflow>(`/automation/workflows/${id}`),
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => apiPost<Workflow>('/automation/workflows', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      toast.success('Workflow created');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Create failed'),
  });
}

export function useToggleWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPatch<Workflow>(`/automation/workflows/${id}/toggle`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Error'),
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/automation/workflows/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      toast.success('Workflow deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Delete failed'),
  });
}
