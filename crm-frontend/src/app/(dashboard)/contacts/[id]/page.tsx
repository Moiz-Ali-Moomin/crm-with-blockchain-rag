'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Mail, Phone, Building2, User } from 'lucide-react';
import { contactsApi } from '@/lib/api/contacts.api';
import { activitiesApi } from '@/lib/api/activities.api';
import { queryKeys } from '@/lib/query/query-keys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DealStatusBadge } from '@/components/crm/status-badge';
import { formatDate, formatCurrency, formatRelativeTime } from '@/lib/utils';

const TABS = ['Info', 'Deals', 'Communications', 'Activities'] as const;
type Tab = (typeof TABS)[number];

const ACTIVITY_ICONS: Record<string, string> = {
  CALL: '📞', EMAIL: '✉️', MEETING: '🤝', NOTE: '📝', TASK: '✅', SMS: '💬', WHATSAPP: '💬',
};

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('Info');

  // getById already embeds deals, tickets, communications in the response
  const { data: contact, isLoading } = useQuery({
    queryKey: queryKeys.contacts.detail(id),
    queryFn: () => contactsApi.getById(id),
  });

  const { data: activitiesData } = useQuery({
    queryKey: queryKeys.activities.timeline('CONTACT', id),
    queryFn: () => activitiesApi.getTimeline('CONTACT', id),
    enabled: tab === 'Activities',
  });

  if (isLoading) return <div className="h-40 animate-pulse bg-slate-200 dark:bg-slate-800 rounded-lg" />;
  if (!contact) return <p>Contact not found.</p>;

  // Embedded by backend findById
  const deals = (contact as any).deals ?? [];
  const communications = (contact as any).communications ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold">{contact.firstName} {contact.lastName}</h1>
          <div className="flex items-center gap-2 text-sm text-slate-500 mt-0.5">
            {contact.jobTitle && <span>{contact.jobTitle}</span>}
            {contact.company && (
              <>
                {contact.jobTitle && <span>·</span>}
                <button onClick={() => router.push(`/companies/${contact.companyId}`)} className="text-blue-600 hover:underline">
                  {contact.company.name}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <div className="flex">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'Info' && (
        <Card>
          <CardContent className="p-5 space-y-3">
            {contact.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail size={14} className="text-slate-400" />
                <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">{contact.email}</a>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone size={14} className="text-slate-400" />
                <span>{contact.phone}</span>
              </div>
            )}
            {contact.company && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 size={14} className="text-slate-400" />
                <span>{contact.company.name}</span>
              </div>
            )}
            {contact.jobTitle && (
              <div className="flex items-center gap-2 text-sm">
                <User size={14} className="text-slate-400" />
                <span>{contact.jobTitle}</span>
              </div>
            )}
            <div className="text-sm text-slate-500">
              Total Spent: <span className="font-semibold text-green-600">{formatCurrency(contact.totalSpent)}</span>
            </div>
            <div className="text-sm text-slate-500">
              Created: <span>{formatDate(contact.createdAt)}</span>
            </div>
            {contact.lastContactedAt && (
              <div className="text-sm text-slate-500">
                Last Contacted: <span>{formatRelativeTime(contact.lastContactedAt)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'Deals' && (
        <div className="space-y-2">
          {deals.length ? deals.map((deal: any) => (
            <Card key={deal.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push(`/deals/${deal.id}`)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{deal.title}</p>
                  <p className="text-sm text-slate-500">{deal.stage?.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-green-600">{formatCurrency(deal.value)}</span>
                  <DealStatusBadge status={deal.status} />
                </div>
              </CardContent>
            </Card>
          )) : <p className="text-sm text-slate-400">No deals.</p>}
        </div>
      )}

      {tab === 'Communications' && (
        <div className="space-y-2">
          {communications.length ? communications.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{c.subject ?? c.channel}</p>
                  <p className="text-xs text-slate-500">{c.fromAddr} → {c.toAddr}</p>
                </div>
                <span className="text-xs text-slate-400">{formatRelativeTime(c.createdAt)}</span>
              </CardContent>
            </Card>
          )) : <p className="text-sm text-slate-400">No communications.</p>}
        </div>
      )}

      {tab === 'Activities' && (
        <div className="space-y-3">
          {activitiesData?.data?.length ? activitiesData.data.map((a) => (
            <div key={a.id} className="flex gap-3 p-3 rounded-md border border-slate-100 dark:border-slate-700">
              <span className="text-lg">{ACTIVITY_ICONS[a.type] ?? '📌'}</span>
              <div>
                <p className="text-sm font-medium">{a.subject}</p>
                {a.body && <p className="text-xs text-slate-500">{a.body}</p>}
                <p className="text-xs text-slate-400">{formatRelativeTime(a.createdAt)}</p>
              </div>
            </div>
          )) : <p className="text-sm text-slate-400">No activities.</p>}
        </div>
      )}
    </div>
  );
}
