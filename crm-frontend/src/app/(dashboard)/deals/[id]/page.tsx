'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, DollarSign, User, Building2 } from 'lucide-react';
import { dealsApi } from '@/lib/api/deals.api';
import { activitiesApi } from '@/lib/api/activities.api';
import { queryKeys } from '@/lib/query/query-keys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DealStatusBadge } from '@/components/crm/status-badge';
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils';

const ACTIVITY_ICONS: Record<string, string> = {
  CALL: '📞', EMAIL: '✉️', MEETING: '🤝', NOTE: '📝', TASK: '✅', SMS: '💬', WHATSAPP: '💬',
};

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: deal, isLoading } = useQuery({
    queryKey: queryKeys.deals.detail(id),
    queryFn: () => dealsApi.getById(id),
  });

  const { data: activitiesData } = useQuery({
    queryKey: queryKeys.activities.timeline('DEAL', id),
    queryFn: () => activitiesApi.getTimeline('DEAL', id),
    enabled: !!id,
  });

  if (isLoading) return <div className="h-40 animate-pulse bg-slate-200 dark:bg-slate-800 rounded-lg" />;
  if (!deal) return <p>Deal not found.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold">{deal.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <DealStatusBadge status={deal.status} />
            <span className="text-lg font-semibold text-green-600">{formatCurrency(deal.value)}</span>
            {deal.stage && <span className="text-sm text-slate-500">· {deal.stage.name}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Deal Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {deal.contact && (
              <div className="flex items-center gap-2 text-sm">
                <User size={14} className="text-slate-400 shrink-0" />
                <button onClick={() => router.push(`/contacts/${deal.contactId}`)} className="text-blue-600 hover:underline">
                  {deal.contact.firstName} {deal.contact.lastName}
                </button>
              </div>
            )}
            {deal.company && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 size={14} className="text-slate-400 shrink-0" />
                <button onClick={() => router.push(`/companies/${deal.companyId}`)} className="text-blue-600 hover:underline">
                  {deal.company.name}
                </button>
              </div>
            )}
            {deal.closingDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={14} className="text-slate-400 shrink-0" />
                <span>{formatDate(deal.closingDate)}</span>
              </div>
            )}
            {deal.owner && (
              <div className="flex items-center gap-2 text-sm">
                <User size={14} className="text-slate-400 shrink-0" />
                <span className="text-slate-500">Owner: {deal.owner.firstName} {deal.owner.lastName}</span>
              </div>
            )}
            {deal.pipeline && (
              <div className="text-sm text-slate-500">
                Pipeline: <span className="font-medium">{deal.pipeline.name}</span>
              </div>
            )}
            {deal.description && (
              <div className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded p-2">
                {deal.description}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Activity Timeline</CardTitle></CardHeader>
          <CardContent>
            {activitiesData?.data?.length ? (
              <div className="space-y-3">
                {activitiesData.data.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex gap-3">
                    <span className="text-lg">{ACTIVITY_ICONS[a.type] ?? '📌'}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{a.subject}</p>
                      {a.body && <p className="text-xs text-slate-500 truncate">{a.body}</p>}
                      <p className="text-xs text-slate-400">{formatRelativeTime(a.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400">No activities yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
