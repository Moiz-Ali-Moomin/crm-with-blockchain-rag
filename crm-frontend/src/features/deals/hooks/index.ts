import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { dealsApi } from '@/lib/api/deals.api';
import { queryKeys } from '@/lib/query/query-keys';
import type { DealFilters } from '@/types';

export function useDeals(filters?: DealFilters) {
  return useQuery({
    queryKey: queryKeys.deals.list(filters),
    queryFn: () => dealsApi.getAll(filters),
  });
}

export function useDeal(id: string) {
  return useQuery({
    queryKey: queryKeys.deals.detail(id),
    queryFn: () => dealsApi.getById(id),
    enabled: !!id,
  });
}

export function useDealKanban(pipelineId: string) {
  return useQuery({
    queryKey: queryKeys.deals.kanban(pipelineId),
    queryFn: () => dealsApi.getKanban(pipelineId),
    enabled: !!pipelineId,
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => dealsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deals.all });
      toast.success('Deal created');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Create failed'),
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => dealsApi.update(id, data),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.deals.all });
      qc.invalidateQueries({ queryKey: queryKeys.deals.detail(id) });
      toast.success('Deal updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });
}

export function useMoveDealStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) =>
      dealsApi.moveStage(id, stageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deals.all });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Move failed'),
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dealsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deals.all });
      toast.success('Deal deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Delete failed'),
  });
}
