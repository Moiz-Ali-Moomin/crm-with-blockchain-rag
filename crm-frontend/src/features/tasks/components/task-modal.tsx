'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateTask, useUpdateTask } from '../hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Task } from '@/types';

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

const schema = z.object({
  title: z.string().min(1, 'Required'),
  description: z.string().optional(),
  status: z.string(),
  priority: z.string(),
  dueDate: z.string().optional(),
  assigneeId: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  task?: Task | null;
  onClose: () => void;
}

export function TaskModal({ task, onClose }: Props) {
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: task
      ? {
          title: task.title,
          description: task.description ?? '',
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
          assigneeId: task.assigneeId ?? '',
        }
      : { status: 'TODO', priority: 'MEDIUM' },
  });

  const onSubmit = async (data: FormData) => {
    if (task) {
      await updateTask.mutateAsync({ id: task.id, data });
    } else {
      await createTask.mutateAsync(data);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{task ? 'Edit Task' : 'Add Task'}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input {...register('title')} />
            {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
          </div>
          <div>
            <Label>Description</Label>
            <textarea
              {...register('description')}
              rows={2}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <select
                {...register('status')}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <Label>Priority</Label>
              <select
                {...register('priority')}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>Due Date</Label>
            <Input type="date" {...register('dueDate')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>
              {task ? 'Save Changes' : 'Create Task'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
