import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { contactsApi } from '@/lib/api/contacts.api';
import { queryKeys } from '@/lib/query/query-keys';

export function useContacts(filters?: object) {
  return useQuery({
    queryKey: queryKeys.contacts.list(filters),
    queryFn: () => contactsApi.getAll(filters),
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: queryKeys.contacts.detail(id),
    queryFn: () => contactsApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => contactsApi.create(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contacts.all });
      toast.success('Contact created');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Create failed'),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => contactsApi.update(id, data),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.contacts.all });
      qc.invalidateQueries({ queryKey: queryKeys.contacts.detail(id) });
      toast.success('Contact updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contactsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contacts.all });
      toast.success('Contact deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Delete failed'),
  });
}
