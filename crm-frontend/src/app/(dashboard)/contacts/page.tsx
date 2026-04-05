'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Search, Eye, Pencil, Trash2 } from 'lucide-react';
import { contactsApi } from '@/lib/api/contacts.api';
import { queryKeys } from '@/lib/query/query-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/crm/data-table';
import { Pagination } from '@/components/shared/pagination';
import { formatRelativeTime, formatCurrency } from '@/lib/utils';
import type { Contact } from '@/types';

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function ContactModal({ contact, onClose }: { contact?: Contact | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: contact
      ? { firstName: contact.firstName, lastName: contact.lastName, email: contact.email ?? '', phone: contact.phone ?? '', jobTitle: contact.jobTitle ?? '' }
      : {},
  });

  const onSubmit = async (data: FormData) => {
    try {
      if (contact) {
        await contactsApi.update(contact.id, data);
        toast.success('Contact updated');
      } else {
        await contactsApi.create(data as any);
        toast.success('Contact created');
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{contact ? 'Edit Contact' : 'Add Contact'}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First Name</Label>
              <Input {...register('firstName')} />
              {errors.firstName && <p className="text-xs text-red-500">{errors.firstName.message}</p>}
            </div>
            <div>
              <Label>Last Name</Label>
              <Input {...register('lastName')} />
              {errors.lastName && <p className="text-xs text-red-500">{errors.lastName.message}</p>}
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div>
            <Label>Phone</Label>
            <Input {...register('phone')} />
          </div>
          <div>
            <Label>Job Title</Label>
            <Input {...register('jobTitle')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>{contact ? 'Save' : 'Create'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ page: 1, limit: 20, search: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.contacts.list(filters),
    queryFn: () => contactsApi.getAll(filters),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contactsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      toast.success('Contact deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Delete failed'),
  });

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (row: Contact) => <span className="font-medium">{row.firstName} {row.lastName}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (row: Contact) => <span className="text-slate-500">{row.email ?? '—'}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row: Contact) => row.phone ?? '—',
    },
    {
      key: 'company',
      header: 'Company',
      render: (row: Contact) =>
        row.company ? (
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/companies/${row.companyId}`); }}
            className="text-blue-600 hover:underline text-sm"
          >
            {row.company.name}
          </button>
        ) : '—',
    },
    {
      key: 'totalSpent',
      header: 'Total Spent',
      render: (row: Contact) => (
        <span className="text-green-600 font-medium">{formatCurrency(row.totalSpent)}</span>
      ),
    },
    {
      key: 'lastContactedAt',
      header: 'Last Contacted',
      render: (row: Contact) => (
        <span className="text-xs text-slate-400">
          {row.lastContactedAt ? formatRelativeTime(row.lastContactedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row: Contact) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/contacts/${row.id}`); }}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setEditContact(row); setModalOpen(true); }}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this contact?')) deleteMutation.mutate(row.id);
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
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search contacts..."
            className="pl-8 w-56"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
          />
        </div>
        <Button onClick={() => { setEditContact(null); setModalOpen(true); }}>
          <Plus size={16} />
          Add Contact
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        emptyMessage="No contacts found."
        onRowClick={(row) => router.push(`/contacts/${row.id}`)}
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
        <ContactModal contact={editContact} onClose={() => { setModalOpen(false); setEditContact(null); }} />
      )}
    </div>
  );
}
