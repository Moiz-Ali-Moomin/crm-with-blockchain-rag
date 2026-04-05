'use client';

import { useRouter } from 'next/navigation';
import { Bell, Trash2 } from 'lucide-react';
import { useMarkNotificationRead, useDeleteNotification } from '../hooks';
import { formatRelativeTime, cn } from '@/lib/utils';
import type { Notification } from '@/types';

interface Props {
  notification: Notification;
}

export function NotificationItem({ notification }: Props) {
  const router = useRouter();
  const markRead = useMarkNotificationRead();
  const deleteNotification = useDeleteNotification();

  const handleClick = () => {
    if (!notification.isRead) markRead.mutate(notification.id);
    if (notification.entityType && notification.entityId) {
      const path = `/${notification.entityType.toLowerCase()}s/${notification.entityId}`;
      router.push(path);
    }
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700 last:border-0',
        !notification.isRead && 'bg-blue-50/50 dark:bg-blue-900/10',
      )}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
          notification.isRead
            ? 'bg-slate-100 dark:bg-slate-700 text-slate-400'
            : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600',
        )}
      >
        <Bell size={14} />
      </div>

      <button onClick={handleClick} className="flex-1 text-left min-w-0">
        <p className={cn('text-sm leading-snug', !notification.isRead && 'font-medium')}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
            {notification.body}
          </p>
        )}
        <p className="text-[11px] text-slate-400 mt-1">{formatRelativeTime(notification.createdAt)}</p>
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); deleteNotification.mutate(notification.id); }}
        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-300 hover:text-red-400 shrink-0"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
