import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { communicationsApi } from '@/lib/api/communications.api';
import { queryKeys } from '@/lib/query/query-keys';

export function useCommunications(filters?: object) {
  return useQuery({
    queryKey: queryKeys.communications.list(filters),
    queryFn: () => communicationsApi.getAll(filters),
  });
}

export function useContactCommunications(contactId: string) {
  return useQuery({
    queryKey: queryKeys.communications.contactTimeline(contactId),
    queryFn: () => communicationsApi.getContactTimeline(contactId),
    enabled: !!contactId,
  });
}

export function useSendEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => communicationsApi.sendEmail(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.communications.all });
      toast.success('Email sent');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Send failed'),
  });
}

export function useSendSms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: object) => communicationsApi.sendSms(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.communications.all });
      toast.success('SMS sent');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Send failed'),
  });
}
