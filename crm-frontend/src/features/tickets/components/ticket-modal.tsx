'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateTicket, useUpdateTicket } from '../hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Ticket } from '@/types';

const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'] as const;
const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

const schema = z.object({
  subject: z.string().min(1, 'Required'),
  description: z.string().min(1, 'Required'),
  status: z.string(),
  priority: z.string(),
  contactId: z.string().optional(),
  assigneeId: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  ticket?: Ticket | null;
  onClose: () => void;
}

export function TicketModal({ ticket, onClose }: Props) {
  const createTicket = useCreateTicket();
  const updateTicket = useUpdateTicket();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: ticket
      ? {
          subject: ticket.subject,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.priority,
          contactId: ticket.contactId ?? '',
          assigneeId: ticket.assigneeId ?? '',
        }
      : { status: 'OPEN', priority: 'MEDIUM' },
  });

  const onSubmit = async (data: FormData) => {
    if (ticket) {
      await updateTicket.mutateAsync({ id: ticket.id, data });
    } else {
      await createTicket.mutateAsync(data);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{ticket ? 'Edit Ticket' : 'New Ticket'}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label>Subject</Label>
            <Input {...register('subject')} />
            {errors.subject && <p className="text-xs text-red-500">{errors.subject.message}</p>}
          </div>
          <div>
            <Label>Description</Label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm resize-none"
            />
            {errors.description && <p className="text-xs text-red-500">{errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <select
                {...register('status')}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                {TICKET_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <Label>Priority</Label>
              <select
                {...register('priority')}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>
              {ticket ? 'Save Changes' : 'Create Ticket'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
