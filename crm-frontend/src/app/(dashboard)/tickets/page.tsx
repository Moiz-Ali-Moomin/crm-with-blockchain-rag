'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { ticketsApi } from '@/lib/api/tickets.api';
import { queryKeys } from '@/lib/query/query-keys';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/crm/data-table';
import { TicketStatusBadge, PriorityBadge } from '@/components/crm/status-badge';
import { Pagination } from '@/components/shared/pagination';
import { formatRelativeTime } from '@/lib/utils';
import type { Ticket, PaginatedData } from '@/types';

const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function TicketsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState({ page: 1, limit: 20, search: '', status: '', priority: '' });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.tickets.list(filters),
    queryFn: () => ticketsApi.getAll(filters) as Promise<PaginatedData<Ticket>>,
  });

  const columns = [
    { key: 'subject', header: 'Subject', render: (row: Ticket) => <span className="font-medium">{row.subject}</span> },
    { key: 'contact', header: 'Contact', render: (row: Ticket) => row.contact ? `${row.contact.firstName} ${row.contact.lastName}` : '—' },
    { key: 'status', header: 'Status', render: (row: Ticket) => <TicketStatusBadge status={row.status} /> },
    { key: 'priority', header: 'Priority', render: (row: Ticket) => <PriorityBadge priority={row.priority} /> },
    { key: 'assignee', header: 'Assignee', render: (row: Ticket) => row.assignee ? `${row.assignee.firstName} ${row.assignee.lastName}` : '—' },
    { key: 'createdAt', header: 'Created', render: (row: Ticket) => <span className="text-xs text-slate-400">{formatRelativeTime(row.createdAt)}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search tickets..." className="pl-8 w-56" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))} />
        </div>
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))} className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          {TICKET_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value, page: 1 }))} className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm">
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} emptyMessage="No tickets found." onRowClick={(row) => router.push(`/tickets/${row.id}`)} />

      {data && (
        <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
      )}
    </div>
  );
}
