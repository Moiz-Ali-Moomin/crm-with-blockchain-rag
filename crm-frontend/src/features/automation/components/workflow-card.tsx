'use client';

import { useRouter } from 'next/navigation';
import { useToggleWorkflow } from '../hooks';
import { formatRelativeTime } from '@/lib/utils';
import type { Workflow } from '@/types';

interface Props {
  workflow: Workflow;
}

export function WorkflowCard({ workflow }: Props) {
  const router = useRouter();
  const toggleWorkflow = useToggleWorkflow();

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
      onClick={() => router.push(`/automation/${workflow.id}`)}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{workflow.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {workflow.triggerType.replace(/_/g, ' ')} · {workflow.runCount.toLocaleString()} runs
          {workflow.errorCount > 0 && (
            <span className="text-red-500 ml-1">· {workflow.errorCount} errors</span>
          )}
        </p>
      </div>
      <span className="text-xs text-slate-400 shrink-0 hidden sm:block">
        {formatRelativeTime(workflow.updatedAt)}
      </span>
      <label
        className="relative inline-flex items-center cursor-pointer shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={workflow.isActive}
          onChange={() => toggleWorkflow.mutate(workflow.id)}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
      </label>
    </div>
  );
}
