'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Mail, MessageSquare } from 'lucide-react';
import { communicationsApi } from '@/lib/api/communications.api';
import { queryKeys } from '@/lib/query/query-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/crm/data-table';
import { Pagination } from '@/components/shared/pagination';
import { formatRelativeTime } from '@/lib/utils';
import type { Communication, PaginatedData } from '@/types';

const emailSchema = z.object({
  toAddr: z.string().email('Invalid email'),
  subject: z.string().min(1, 'Required'),
  body: z.string().min(1, 'Required'),
});
type EmailForm = z.infer<typeof emailSchema>;

const smsSchema = z.object({
  toAddr: z.string().min(5, 'Enter a phone number'),
  body: z.string().min(1, 'Required'),
});
type SmsForm = z.infer<typeof smsSchema>;

function EmailModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EmailForm>({ resolver: zodResolver(emailSchema) });

  const onSubmit = async (data: EmailForm) => {
    try {
      await communicationsApi.sendEmail(data);
      toast.success('Email queued');
      queryClient.invalidateQueries({ queryKey: queryKeys.communications.all });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Send Email</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div><Label>To</Label><Input type="email" {...register('toAddr')} />{errors.toAddr && <p className="text-xs text-red-500">{errors.toAddr.message}</p>}</div>
          <div><Label>Subject</Label><Input {...register('subject')} />{errors.subject && <p className="text-xs text-red-500">{errors.subject.message}</p>}</div>
          <div>
            <Label>Body</Label>
            <textarea {...register('body')} rows={4} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm resize-none" />
            {errors.body && <p className="text-xs text-red-500">{errors.body.message}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Send Email</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SmsModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SmsForm>({ resolver: zodResolver(smsSchema) });

  const onSubmit = async (data: SmsForm) => {
    try {
      await communicationsApi.sendSms(data);
      toast.success('SMS queued');
      queryClient.invalidateQueries({ queryKey: queryKeys.communications.all });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">Send SMS</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div><Label>To (phone number)</Label><Input {...register('toAddr')} placeholder="+1234567890" />{errors.toAddr && <p className="text-xs text-red-500">{errors.toAddr.message}</p>}</div>
          <div>
            <Label>Message</Label>
            <textarea {...register('body')} rows={3} className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm resize-none" />
            {errors.body && <p className="text-xs text-red-500">{errors.body.message}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Send SMS</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const CHANNEL_COLORS: Record<string, string> = {
  EMAIL: 'info', SMS: 'secondary', WHATSAPP: 'success', PHONE: 'warning',
};

export default function CommunicationsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState({ page: 1, limit: 20 });
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [smsModalOpen, setSmsModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.communications.list(filters),
    queryFn: () => communicationsApi.getAll(filters) as Promise<PaginatedData<Communication>>,
  });

  const columns = [
    { key: 'channel', header: 'Channel', render: (row: Communication) => <Badge variant={(CHANNEL_COLORS[row.channel] ?? 'secondary') as any}>{row.channel}</Badge> },
    { key: 'direction', header: 'Dir.', render: (row: Communication) => <span className="text-xs text-slate-500">{row.direction}</span> },
    { key: 'status', header: 'Status', render: (row: Communication) => <span className="text-xs">{row.status}</span> },
    { key: 'fromAddr', header: 'From', render: (row: Communication) => <span className="text-xs text-slate-500">{row.fromAddr}</span> },
    { key: 'toAddr', header: 'To', render: (row: Communication) => <span className="text-xs text-slate-500">{row.toAddr}</span> },
    { key: 'subject', header: 'Subject', render: (row: Communication) => row.subject ?? '—' },
    {
      key: 'contact',
      header: 'Contact',
      render: (row: Communication) =>
        row.contact ? (
          <button onClick={(e) => { e.stopPropagation(); router.push(`/contacts/${row.contactId}`); }} className="text-blue-600 hover:underline text-sm">
            {row.contact.firstName} {row.contact.lastName}
          </button>
        ) : '—',
    },
    { key: 'createdAt', header: 'Date', render: (row: Communication) => <span className="text-xs text-slate-400">{formatRelativeTime(row.createdAt)}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setEmailModalOpen(true)}><Mail size={14} />Send Email</Button>
        <Button variant="outline" onClick={() => setSmsModalOpen(true)}><MessageSquare size={14} />Send SMS</Button>
      </div>

      <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} emptyMessage="No communications found." />

      {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} limit={data.limit} onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />}

      {emailModalOpen && <EmailModal onClose={() => setEmailModalOpen(false)} />}
      {smsModalOpen && <SmsModal onClose={() => setSmsModalOpen(false)} />}
    </div>
  );
}
