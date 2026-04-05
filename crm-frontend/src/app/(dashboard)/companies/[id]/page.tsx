'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Globe, Phone, MapPin, Users, DollarSign } from 'lucide-react';
import { companiesApi } from '@/lib/api/companies.api';
import { activitiesApi } from '@/lib/api/activities.api';
import { queryKeys } from '@/lib/query/query-keys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DealStatusBadge } from '@/components/crm/status-badge';
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const TABS = ['Contacts', 'Deals', 'Activities'] as const;
type Tab = (typeof TABS)[number];

const ACTIVITY_ICONS: Record<string, string> = {
  CALL: '📞', EMAIL: '✉️', MEETING: '🤝', NOTE: '📝', TASK: '✅', SMS: '💬', WHATSAPP: '💬',
};

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('Contacts');

  const { data: company, isLoading } = useQuery({
    queryKey: queryKeys.companies.detail(id),
    queryFn: () => companiesApi.getById(id),
  });

  const { data: activitiesData } = useQuery({
    queryKey: queryKeys.activities.timeline('COMPANY', id),
    queryFn: () => activitiesApi.getTimeline('COMPANY', id),
    enabled: tab === 'Activities',
  });

  if (isLoading) return <div className="h-40 animate-pulse bg-slate-200 dark:bg-slate-800 rounded-lg" />;
  if (!company) return <p>Company not found.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold">{company.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {company.industry && <Badge variant="secondary">{company.industry}</Badge>}
            {company.website && (
              <a href={company.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <Globe size={12} />
                {company.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-2">
          <Users size={16} className="text-blue-500" />
          <div><p className="text-xs text-slate-500">Employees</p><p className="font-semibold">{company.employeeCount?.toLocaleString() ?? '—'}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-2">
          <DollarSign size={16} className="text-green-500" />
          <div><p className="text-xs text-slate-500">Annual Revenue</p><p className="font-semibold">{company.annualRevenue ? formatCurrency(company.annualRevenue) : '—'}</p></div>
        </CardContent></Card>
        {company.city && <Card><CardContent className="p-4 flex items-center gap-2">
          <MapPin size={16} className="text-red-400" />
          <div><p className="text-xs text-slate-500">Location</p><p className="font-semibold">{company.city}{company.country ? `, ${company.country}` : ''}</p></div>
        </CardContent></Card>}
        {company.phone && <Card><CardContent className="p-4 flex items-center gap-2">
          <Phone size={16} className="text-slate-400" />
          <div><p className="text-xs text-slate-500">Phone</p><p className="font-semibold">{company.phone}</p></div>
        </CardContent></Card>}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <div className="flex gap-0">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{t}</button>
          ))}
        </div>
      </div>

      {tab === 'Contacts' && (
        <div className="space-y-2">
          {company.contacts?.length ? company.contacts.map((c) => (
            <Card key={c.id} className="cursor-pointer hover:shadow-md" onClick={() => router.push(`/contacts/${c.id}`)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{c.firstName} {c.lastName}</p>
                  <p className="text-sm text-slate-500">{c.jobTitle ?? c.email ?? '—'}</p>
                </div>
                <p className="text-sm text-green-600 font-medium">{formatCurrency(c.totalSpent)}</p>
              </CardContent>
            </Card>
          )) : <p className="text-sm text-slate-400">No contacts.</p>}
        </div>
      )}

      {tab === 'Deals' && (
        <div className="space-y-2">
          {company.deals?.length ? company.deals.map((d) => (
            <Card key={d.id} className="cursor-pointer hover:shadow-md" onClick={() => router.push(`/deals/${d.id}`)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{d.title}</p>
                  <p className="text-sm text-slate-500">{d.stage?.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-green-600">{formatCurrency(d.value)}</span>
                  <DealStatusBadge status={d.status} />
                </div>
              </CardContent>
            </Card>
          )) : <p className="text-sm text-slate-400">No deals.</p>}
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
