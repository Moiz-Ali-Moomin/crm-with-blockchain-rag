'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Search, Eye, Trash2, LayoutList, LayoutGrid } from 'lucide-react';
import { dealsApi } from '@/lib/api/deals.api';
import { pipelinesApi } from '@/lib/api/pipelines.api';
import { queryKeys } from '@/lib/query/query-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/crm/data-table';
import { DealStatusBadge } from '@/components/crm/status-badge';
import { KanbanBoard } from '@/components/crm/kanban/kanban-board';
import { Pagination } from '@/components/shared/pagination';
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils';
import type { Deal } from '@/types';

const schema = z.object({
  title: z.string().min(1, 'Required'),
  value: z.coerce.number().min(0),
  pipelineId: z.string().min(1, 'Required'),
  stageId: z.string().min(1, 'Required'),
  closingDate: z.string().optional(),
  description: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function DealModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [selectedPipelineId, setSelectedPipelineId] = useState('');

  const { data: pipelines } = useQuery({
    queryKey: queryKeys.pipelines.all,
    queryFn: pipelinesApi.getAll,
  });

  const stages = pipelines?.find((p) => p.id === selectedPipelineId)?.stages ?? [];

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { value: 0 },
  });

  const onSubmit = async (data: FormData) => {
    try {
      await dealsApi.create(data);
      toast.success('Deal created');
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">New Deal</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input {...register('title')} />
            {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
          </div>
          <div>
            <Label>Value ($)</Label>
            <Input type="number" min={0} {...register('value')} />
          </div>
          <div>
            <Label>Pipeline</Label>
            <select
              {...register('pipelineId')}
              onChange={(e) => {
                setValue('pipelineId', e.target.value);
                setSelectedPipelineId(e.target.value);
                setValue('stageId', '');
              }}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="">Select pipeline</option>
              {pipelines?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {errors.pipelineId && <p className="text-xs text-red-500">{errors.pipelineId.message}</p>}
          </div>
          <div>
            <Label>Stage</Label>
            <select
              {...register('stageId')}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="">Select stage</option>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {errors.stageId && <p className="text-xs text-red-500">{errors.stageId.message}</p>}
          </div>
          <div>
            <Label>Closing Date</Label>
            <Input type="date" {...register('closingDate')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Create Deal</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DealsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [filters, setFilters] = useState({ page: 1, limit: 20, search: '' });
  const [modalOpen, setModalOpen] = useState(false);

  const { data: pipelines } = useQuery({ queryKey: queryKeys.pipelines.all, queryFn: pipelinesApi.getAll });
  const defaultPipelineId = pipelines?.find((p) => p.isDefault)?.id ?? pipelines?.[0]?.id ?? '';

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.deals.list(filters),
    queryFn: () => dealsApi.getAll(filters),
    enabled: view === 'list',
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dealsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.deals.all }); toast.success('Deal deleted'); },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Delete failed'),
  });

  const columns = [
    { key: 'title', header: 'Title', render: (row: Deal) => <span className="font-medium">{row.title}</span> },
    { key: 'contact', header: 'Contact', render: (row: Deal) => row.contact ? `${row.contact.firstName} ${row.contact.lastName}` : '—' },
    { key: 'company', header: 'Company', render: (row: Deal) => row.company?.name ?? '—' },
    { key: 'stage', header: 'Stage', render: (row: Deal) => row.stage?.name ?? '—' },
    { key: 'value', header: 'Value', render: (row: Deal) => <span className="font-semibold text-green-600">{formatCurrency(row.value)}</span> },
    { key: 'status', header: 'Status', render: (row: Deal) => <DealStatusBadge status={row.status} /> },
    { key: 'closingDate', header: 'Closing', render: (row: Deal) => row.closingDate ? formatDate(row.closingDate) : '—' },
    {
      key: 'actions', header: '',
      render: (row: Deal) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); router.push(`/deals/${row.id}`); }} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"><Eye size={14} /></button>
          <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) deleteMutation.mutate(row.id); }} className="p-1 rounded hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {view === 'list' && (
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Search deals..." className="pl-8 w-48" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))} />
            </div>
          )}
          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
            <button onClick={() => setView('list')} className={`p-2 ${view === 'list' ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-500'}`}><LayoutList size={16} /></button>
            <button onClick={() => setView('kanban')} className={`p-2 ${view === 'kanban' ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-500'}`}><LayoutGrid size={16} /></button>
          </div>
        </div>
        <Button onClick={() => setModalOpen(true)}><Plus size={16} />New Deal</Button>
      </div>

      {view === 'list' ? (
        <>
          <DataTable columns={columns} data={(data as any)?.data ?? []} isLoading={isLoading} emptyMessage="No deals found." onRowClick={(row) => router.push(`/deals/${row.id}`)} />
          {data && <Pagination page={(data as any).page ?? 1} totalPages={(data as any).totalPages ?? 1} total={(data as any).total ?? 0} limit={(data as any).limit ?? 20} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />}
        </>
      ) : (
        defaultPipelineId && <KanbanBoard pipelineId={defaultPipelineId} />
      )}

      {modalOpen && <DealModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
