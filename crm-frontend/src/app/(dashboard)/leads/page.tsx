'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Pencil, Trash2, Plus, Search } from 'lucide-react';
import { useLeads, useDeleteLead } from '@/features/leads/hooks';
import { LeadModal } from '@/features/leads/components/lead-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/crm/data-table';
import { LeadStatusBadge } from '@/components/crm/status-badge';
import { ScoreBadge } from '@/components/crm/score-badge';
import { Pagination } from '@/components/shared/pagination';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatRelativeTime, getInitials } from '@/lib/utils';
import { LEAD_STATUSES, LEAD_SOURCES } from '@/features/leads/constants';
import type { Lead } from '@/types';

export default function LeadsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState({ page: 1, limit: 20, search: '', status: '', source: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);

  const { data, isLoading } = useLeads(filters);
  const deleteLead = useDeleteLead();

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (row: Lead) => (
        <span className="font-medium">{row.firstName} {row.lastName}</span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (row: Lead) => <span className="text-slate-500">{row.email ?? '—'}</span>,
    },
    {
      key: 'companyName',
      header: 'Company',
      render: (row: Lead) => row.companyName ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: Lead) => <LeadStatusBadge status={row.status} />,
    },
    {
      key: 'score',
      header: 'Score',
      render: (row: Lead) => <ScoreBadge score={row.score} />,
    },
    {
      key: 'source',
      header: 'Source',
      render: (row: Lead) => (
        <span className="text-xs text-slate-500">{row.source.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'assignee',
      header: 'Assignee',
      render: (row: Lead) =>
        row.assignee ? (
          <Avatar className="w-7 h-7">
            <AvatarFallback className="bg-blue-500 text-white text-[10px]">
              {getInitials(row.assignee.firstName, row.assignee.lastName)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row: Lead) => (
        <span className="text-xs text-slate-400">{formatRelativeTime(row.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row: Lead) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/leads/${row.id}`); }}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEditLead(row); setModalOpen(true); }}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this lead?')) deleteLead.mutate(row.id);
            }}
            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search leads..."
              className="pl-8 w-56"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filters.source}
            onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value, page: 1 }))}
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
          >
            <option value="">All Sources</option>
            {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <Button onClick={() => { setEditLead(null); setModalOpen(true); }}>
          <Plus size={16} />
          Add Lead
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        emptyMessage="No leads found."
        onRowClick={(row) => router.push(`/leads/${row.id}`)}
      />

      {data && (
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          limit={data.meta.limit}
          onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
        />
      )}

      {modalOpen && (
        <LeadModal
          lead={editLead}
          onClose={() => { setModalOpen(false); setEditLead(null); }}
        />
      )}
    </div>
  );
}
