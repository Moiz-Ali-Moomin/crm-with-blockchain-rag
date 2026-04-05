import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { companiesApi } from '@/lib/api/companies.api';
import { queryKeys } from '@/lib/query/query-keys';

export function useCompanies(filters?: object) {
  return useQuery({
    queryKey: queryKeys.companies.list(filters),
    queryFn: () => companiesApi.getAll(filters),
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: queryKeys.companies.detail(id),
    queryFn: () => companiesApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => companiesApi.create(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.companies.all });
      toast.success('Company created');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Create failed'),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => companiesApi.update(id, data),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.companies.all });
      qc.invalidateQueries({ queryKey: queryKeys.companies.detail(id) });
      toast.success('Company updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => companiesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.companies.all });
      toast.success('Company deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Delete failed'),
  });
}
