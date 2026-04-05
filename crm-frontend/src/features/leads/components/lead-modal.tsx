'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateLead, useUpdateLead } from '../hooks';
import { LEAD_STATUSES, LEAD_SOURCES } from '../constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Lead } from '@/types';
import type { CreateLeadDto } from '@/lib/api/leads.api';

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  score: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  lead?: Lead | null;
  onClose: () => void;
}

export function LeadModal({ lead, onClose }: Props) {
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: lead
      ? {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email ?? '',
          phone: lead.phone ?? '',
          companyName: lead.companyName ?? '',
          status: lead.status,
          source: lead.source,
          score: lead.score,
          notes: lead.notes ?? '',
        }
      : { status: 'NEW', source: 'WEBSITE', score: 0 },
  });

  const onSubmit = async (data: FormData) => {
    if (lead) {
      await updateLead.mutateAsync({ id: lead.id, data });
    } else {
      await createLead.mutateAsync(data as CreateLeadDto);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold mb-4">{lead ? 'Edit Lead' : 'Add Lead'}</h2>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <div>
              <Label>Phone</Label>
              <Input {...register('phone')} />
            </div>
          </div>
          <div>
            <Label>Company</Label>
            <Input {...register('companyName')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <select
                {...register('status')}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label>Source</Label>
              <select
                {...register('source')}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>Score (0–100)</Label>
            <Input type="number" min={0} max={100} {...register('score')} />
          </div>
          <div>
            <Label>Notes</Label>
            <textarea
              {...register('notes')}
              rows={2}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>
              {lead ? 'Save Changes' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
