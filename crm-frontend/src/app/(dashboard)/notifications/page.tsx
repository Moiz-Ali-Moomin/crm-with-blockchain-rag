'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2, CheckCheck } from 'lucide-react';
import { notificationsApi } from '@/lib/api/notifications.api';
import { queryKeys } from '@/lib/query/query-keys';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { formatRelativeTime, cn } from '@/lib/utils';
import type { PaginatedData, Notification } from '@/types';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.notifications.list(user?.id ?? ''),
    queryFn: () => notificationsApi.getAll() as Promise<PaginatedData<Notification>>,
    enabled: !!user?.id,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      toast.success('All marked as read');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Error'),
  });

  const notifications = data?.data ?? [];

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllReadMutation.mutate()}
          isLoading={markAllReadMutation.isPending}
        >
          <CheckCheck size={14} />
          Mark All Read
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No notifications.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.isRead && markReadMutation.mutate(n.id)}
              className={cn(
                'flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                n.isRead
                  ? 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'
                  : 'border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20'
              )}
            >
              {!n.isRead && (
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium', n.isRead && 'text-slate-600 dark:text-slate-400')}>
                  {n.title}
                </p>
                <p className="text-sm text-slate-500 truncate">{n.body}</p>
                <p className="text-xs text-slate-400 mt-0.5">{formatRelativeTime(n.createdAt)}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMutation.mutate(n.id);
                }}
                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
