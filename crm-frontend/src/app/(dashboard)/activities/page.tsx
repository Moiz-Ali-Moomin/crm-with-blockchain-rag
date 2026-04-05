'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { activitiesApi } from '@/lib/api/activities.api';
import { queryKeys } from '@/lib/query/query-keys';
import { DataTable } from '@/components/crm/data-table';
import { Pagination } from '@/components/shared/pagination';
import { formatRelativeTime } from '@/lib/utils';
import type { Activity, PaginatedData } from '@/types';

const ACTIVITY_TYPES = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'SMS', 'WHATSAPP'];
const ENTITY_TYPES = ['LEAD', 'CONTACT', 'COMPANY', 'DEAL', 'TICKET'];
const ICONS: Record<string, string> = {
  CALL: '📞', EMAIL: '✉️', MEETING: '🤝', NOTE: '📝', TASK: '✅', SMS: '💬', WHATSAPP: '💬',
};

export default function ActivitiesPage() {
  const router = useRouter();
  const [filters, setFilters] = useState({ page: 1, limit: 20, type: '', entityType: '' });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.activities.list(filters),
    queryFn: () => activitiesApi.getAll(filters) as Promise<PaginatedData<Activity>>,
  });

  const columns = [
    {
      key: 'type',
      header: 'Type',
      render: (row: Activity) => (
        <span className="flex items-center gap-1.5 text-sm">
          <span>{ICONS[row.type] ?? '📌'}</span>
          {row.type}
        </span>
      ),
    },
    { key: 'subject', header: 'Subject', render: (row: Activity) => <span className="font-medium">{row.subject}</span> },
    {
      key: 'entity',
      header: 'Related To',
      render: (row: Activity) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const path = row.entityType.toLowerCase() + 's';
            router.push(`/${path}/${row.entityId}`);
          }}
          className="text-blue-600 hover:underline text-sm"
        >
          {row.entityType} ↗
        </button>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (row: Activity) => row.duration ? `${row.duration} min` : '—',
    },
    {
      key: 'createdBy',
      header: 'Created By',
      render: (row: Activity) =>
        row.createdBy ? `${row.createdBy.firstName} ${row.createdBy.lastName}` : '—',
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (row: Activity) => <span className="text-xs text-slate-400">{formatRelativeTime(row.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value, page: 1 }))} className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm">
          <option value="">All Types</option>
          {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filters.entityType} onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value, page: 1 }))} className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm">
          <option value="">All Entities</option>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} emptyMessage="No activities found." />

      {data && (
        <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
      )}
    </div>
  );
}
