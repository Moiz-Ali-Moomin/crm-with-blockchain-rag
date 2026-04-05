import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ticketsApi } from '@/lib/api/tickets.api';
import { queryKeys } from '@/lib/query/query-keys';
import type { TicketFilters } from '@/types';

export function useTickets(filters?: TicketFilters) {
  return useQuery({
    queryKey: queryKeys.tickets.list(filters),
    queryFn: () => ticketsApi.getAll(filters),
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: queryKeys.tickets.detail(id),
    queryFn: () => ticketsApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => ticketsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tickets.all });
      toast.success('Ticket created');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Create failed'),
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => ticketsApi.update(id, data),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.tickets.all });
      qc.invalidateQueries({ queryKey: queryKeys.tickets.detail(id) });
      toast.success('Ticket updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Update failed'),
  });
}

export function useAddTicketReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, body, isInternal = false }: { ticketId: string; body: string; isInternal?: boolean }) =>
      ticketsApi.addReply(ticketId, { body, isInternal }),
    onSuccess: (_r, { ticketId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.tickets.detail(ticketId) });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Reply failed'),
  });
}

export function useDeleteTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ticketsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tickets.all });
      toast.success('Ticket deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Delete failed'),
  });
}
