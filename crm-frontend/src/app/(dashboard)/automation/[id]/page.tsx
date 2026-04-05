'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Play, Pause, Trash2, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import { apiGet, apiPatch, apiDelete } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRelativeTime } from '@/lib/utils';
import type { Workflow } from '@/types';

const WORKFLOW_KEY = (id: string) => ['workflows', id] as const;

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <span className="text-xs text-slate-400 w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-700 dark:text-slate-200 break-all">{value}</span>
    </div>
  );
}

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: workflow, isLoading } = useQuery({
    queryKey: WORKFLOW_KEY(id),
    queryFn: () => apiGet<Workflow>(`/automation/workflows/${id}`),
    enabled: !!id,
  });

  const toggleMutation = useMutation({
    mutationFn: () => apiPatch<Workflow>(`/automation/workflows/${id}/toggle`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_KEY(id) });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success(workflow?.isActive ? 'Workflow paused' : 'Workflow activated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Error'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/automation/workflows/${id}`),
    onSuccess: () => {
      toast.success('Workflow deleted');
      router.push('/automation');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Delete failed'),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-56 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="text-center py-16 text-slate-400">
        Workflow not found.{' '}
        <button onClick={() => router.push('/automation')} className="text-blue-600 hover:underline">
          Back to Automation
        </button>
      </div>
    );
  }

  const actions = Array.isArray(workflow.actions) ? workflow.actions : [];

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/automation')}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-semibold flex-1 truncate">{workflow.name}</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => toggleMutation.mutate()}
            isLoading={toggleMutation.isPending}
          >
            {workflow.isActive ? <Pause size={14} /> : <Play size={14} />}
            {workflow.isActive ? 'Pause' : 'Activate'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-500 border-red-200 hover:bg-red-50"
            onClick={() => { if (confirm('Delete this workflow?')) deleteMutation.mutate(); }}
            isLoading={deleteMutation.isPending}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {workflow.runCount.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Total Runs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className={`text-2xl font-bold ${workflow.errorCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {workflow.errorCount.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Errors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <div className="flex items-center justify-center gap-1">
              {workflow.isActive
                ? <CheckCircle size={20} className="text-green-500" />
                : <Pause size={20} className="text-slate-400" />}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{workflow.isActive ? 'Active' : 'Paused'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Trigger */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap size={14} className="text-yellow-500" />
            Trigger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          <InfoRow label="Type" value={workflow.triggerType.replace(/_/g, ' ')} />
          {Object.entries(workflow.triggerConfig ?? {}).map(([k, v]) => (
            <InfoRow key={k} label={k} value={String(v)} />
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      {actions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Actions ({actions.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {actions.map((action: any, i: number) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-sm"
              >
                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 text-xs flex items-center justify-center shrink-0 font-medium mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-200">
                    {(action.type ?? 'Action').replace(/_/g, ' ')}
                  </p>
                  {Object.entries(action)
                    .filter(([k]) => k !== 'type')
                    .map(([k, v]) => (
                      <p key={k} className="text-xs text-slate-400">
                        {k}: {String(v)}
                      </p>
                    ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Conditions */}
      {workflow.conditions && Object.keys(workflow.conditions).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle size={14} className="text-orange-400" />
              Conditions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {Object.entries(workflow.conditions).map(([k, v]) => (
              <InfoRow key={k} label={k} value={String(v)} />
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-slate-400 pb-2">
        Last updated {formatRelativeTime(workflow.updatedAt)}
      </p>
    </div>
  );
}
