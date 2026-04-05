'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateDeal, useUpdateDeal } from '../hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Deal } from '@/types';

const DEAL_STATUSES = ['OPEN', 'WON', 'LOST', 'ON_HOLD'] as const;

const schema = z.object({
  title: z.string().min(1, 'Required'),
  value: z.coerce.number().min(0, 'Must be ≥ 0'),
  status: z.string(),
  pipelineId: z.string().min(1, 'Required'),
  stageId: z.string().min(1, 'Required'),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  closingDate: z.string().optional(),
  description: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  deal?: Deal | null;
  /** Pre-selected pipeline & stage for new deals */
  defaultPipelineId?: string;
  defaultStageId?: string;
  onClose: () => void;
}

export function DealModal({ deal, defaultPipelineId = '', defaultStageId = '', onClose }: Props) {
  const createDeal = useCreateDeal();
  const updateDeal = useUpdateDeal();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: deal
      ? {
          title: deal.title,
          value: deal.value,
          status: deal.status,
          pipelineId: deal.pipelineId,
          stageId: deal.stageId,
          contactId: deal.contactId ?? '',
          companyId: deal.companyId ?? '',
          closingDate: deal.closingDate ? deal.closingDate.slice(0, 10) : '',
          description: deal.description ?? '',
        }
      : { status: 'OPEN', pipelineId: defaultPipelineId, stageId: defaultStageId, value: 0 },
  });

  const onSubmit = async (data: FormData) => {
    if (deal) {
      await updateDeal.mutateAsync({ id: deal.id, data });
    } else {
      await createDeal.mutateAsync(data);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold mb-4">{deal ? 'Edit Deal' : 'Add Deal'}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input {...register('title')} />
            {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Value ($)</Label>
              <Input type="number" min={0} step="0.01" {...register('value')} />
              {errors.value && <p className="text-xs text-red-500">{errors.value.message}</p>}
            </div>
            <div>
              <Label>Status</Label>
              <select
                {...register('status')}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                {DEAL_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Pipeline ID</Label>
              <Input {...register('pipelineId')} placeholder="Pipeline ID" />
              {errors.pipelineId && <p className="text-xs text-red-500">{errors.pipelineId.message}</p>}
            </div>
            <div>
              <Label>Stage ID</Label>
              <Input {...register('stageId')} placeholder="Stage ID" />
              {errors.stageId && <p className="text-xs text-red-500">{errors.stageId.message}</p>}
            </div>
          </div>
          <div>
            <Label>Closing Date</Label>
            <Input type="date" {...register('closingDate')} />
          </div>
          <div>
            <Label>Description</Label>
            <textarea
              {...register('description')}
              rows={2}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>
              {deal ? 'Save Changes' : 'Create Deal'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
