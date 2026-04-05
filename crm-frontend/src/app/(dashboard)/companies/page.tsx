'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Search, Eye, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { companiesApi } from '@/lib/api/companies.api';
import { queryKeys } from '@/lib/query/query-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/crm/data-table';
import { Pagination } from '@/components/shared/pagination';
import { formatCurrency } from '@/lib/utils';
import type { Company, PaginatedData } from '@/types';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  industry: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  employeeCount: z.coerce.number().optional(),
  annualRevenue: z.coerce.number().optional(),
});
type FormData = z.infer<typeof schema>;

function CompanyModal({ company, onClose }: { company?: Company | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: company
      ? { name: company.name, industry: company.industry ?? '', website: company.website ?? '', phone: company.phone ?? '', city: company.city ?? '', country: company.country ?? '', employeeCount: company.employeeCount ?? undefined, annualRevenue: company.annualRevenue ?? undefined }
      : {},
  });

  const onSubmit = async (data: FormData) => {
    try {
      if (company) {
        await companiesApi.update(company.id, data);
        toast.success('Company updated');
      } else {
        await companiesApi.create(data);
        toast.success('Company created');
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold mb-4">{company ? 'Edit Company' : 'Add Company'}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label>Company Name</Label>
            <Input {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Industry</Label>
              <Input {...register('industry')} />
            </div>
            <div>
              <Label>Website</Label>
              <Input {...register('website')} placeholder="https://" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Phone</Label>
              <Input {...register('phone')} />
            </div>
            <div>
              <Label>City</Label>
              <Input {...register('city')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Employees</Label>
              <Input type="number" {...register('employeeCount')} />
            </div>
            <div>
              <Label>Annual Revenue</Label>
              <Input type="number" {...register('annualRevenue')} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>{company ? 'Save' : 'Create'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CompaniesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ page: 1, limit: 20, search: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.companies.list(filters),
    queryFn: () => companiesApi.getAll(filters) as Promise<PaginatedData<Company>>,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => companiesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      toast.success('Company deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Delete failed'),
  });

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (row: Company) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'industry',
      header: 'Industry',
      render: (row: Company) => row.industry ?? '—',
    },
    {
      key: 'website',
      header: 'Website',
      render: (row: Company) =>
        row.website ? (
          <a href={row.website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-blue-600 hover:underline text-sm">
            <ExternalLink size={12} />
            {row.website.replace(/^https?:\/\//, '')}
          </a>
        ) : '—',
    },
    {
      key: 'employeeCount',
      header: 'Employees',
      render: (row: Company) => row.employeeCount?.toLocaleString() ?? '—',
    },
    {
      key: 'annualRevenue',
      header: 'Revenue',
      render: (row: Company) => row.annualRevenue ? formatCurrency(row.annualRevenue) : '—',
    },
    {
      key: 'city',
      header: 'City',
      render: (row: Company) => row.city ?? '—',
    },
    {
      key: 'actions',
      header: '',
      render: (row: Company) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); router.push(`/companies/${row.id}`); }} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"><Eye size={14} /></button>
          <button onClick={(e) => { e.stopPropagation(); setEditCompany(row); setModalOpen(true); }} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"><Pencil size={14} /></button>
          <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) deleteMutation.mutate(row.id); }} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search companies..." className="pl-8 w-56" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))} />
        </div>
        <Button onClick={() => { setEditCompany(null); setModalOpen(true); }}><Plus size={16} />Add Company</Button>
      </div>

      <DataTable columns={columns} data={(data as any)?.data ?? []} isLoading={isLoading} emptyMessage="No companies found." onRowClick={(row) => router.push(`/companies/${row.id}`)} />

      {data && (
        <Pagination page={(data as any).page ?? 1} totalPages={(data as any).totalPages ?? 1} total={(data as any).total ?? 0} limit={(data as any).limit ?? 20} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
      )}

      {modalOpen && <CompanyModal company={editCompany} onClose={() => { setModalOpen(false); setEditCompany(null); }} />}
    </div>
  );
}
