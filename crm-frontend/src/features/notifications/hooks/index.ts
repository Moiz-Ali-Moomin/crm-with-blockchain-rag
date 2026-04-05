import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notificationsApi } from '@/lib/api/notifications.api';
import { queryKeys } from '@/lib/query/query-keys';

export function useNotifications(userId: string, params?: { page?: number; limit?: number; unreadOnly?: boolean }) {
  return useQuery({
    queryKey: queryKeys.notifications.list(userId),
    queryFn: () => notificationsApi.getAll(params),
    enabled: !!userId,
  });
}

export function useUnreadCount(userId: string) {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(userId),
    queryFn: notificationsApi.getUnreadCount,
    enabled: !!userId,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
      toast.success('All notifications marked as read');
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
