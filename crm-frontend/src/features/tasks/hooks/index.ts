import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tasksApi } from '@/lib/api/tasks.api';
import { queryKeys } from '@/lib/query/query-keys';
import type { TaskFilters } from '@/types';

export function useTasks(filters?: TaskFilters) {
  return useQuery({
    queryKey: queryKeys.tasks.list(filters),
    queryFn: () => tasksApi.getAll(filters),
  });
}

export function useMyTasks(userId: string) {
  return useQuery({
    queryKey: queryKeys.tasks.myTasks(userId),
    queryFn: () => tasksApi.getMyTasks(),
    enabled: !!userId,
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(id),
    queryFn: () => tasksApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => tasksApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast.success('Task created');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Create failed'),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => tasksApi.update(id, data),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
      qc.invalidateQueries({ queryKey: queryKeys.tasks.detail(id) });
      toast.success('Task updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.complete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast.success('Task completed');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Error'),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast.success('Task deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Delete failed'),
  });
}
