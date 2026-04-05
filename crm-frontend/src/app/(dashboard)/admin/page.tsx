'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/crm/data-table';
import { formatRelativeTime } from '@/lib/utils';
import type { Tenant, AuditLog, PaginatedData } from '@/types';

export default function AdminPage() {
  const router = useRouter();

  const { data: tenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: () => apiGet<PaginatedData<Tenant>>('/admin/tenants'),
  });

  const { data: auditLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['admin', 'audit-logs'],
    queryFn: () => apiGet<PaginatedData<AuditLog>>('/admin/audit-logs', { limit: 10 }),
  });

  const tenantColumns = [
    {
      key: 'name',
      header: 'Name',
      render: (row: Tenant) => (
        <button
          onClick={() => router.push(`/admin/tenants/${row.id}`)}
          className="font-medium text-blue-600 hover:underline"
        >
          {row.name}
        </button>
      ),
    },
    { key: 'slug', header: 'Slug', render: (row: Tenant) => <code className="text-xs">{row.slug}</code> },
    { key: 'plan', header: 'Plan', render: (row: Tenant) => row.plan },
    {
      key: 'isActive',
      header: 'Status',
      render: (row: Tenant) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${row.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
          {row.isActive ? 'Active' : 'Suspended'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row: Tenant) => <span className="text-xs text-slate-400">{formatRelativeTime(row.createdAt)}</span>,
    },
  ];

  const auditColumns = [
    { key: 'action', header: 'Action', render: (row: AuditLog) => <code className="text-xs">{row.action}</code> },
    {
      key: 'user',
      header: 'User',
      render: (row: AuditLog) =>
        row.user ? `${row.user.firstName} ${row.user.lastName}` : <span className="text-slate-400">System</span>,
    },
    {
      key: 'entityType',
      header: 'Entity',
      render: (row: AuditLog) =>
        row.entityType ? `${row.entityType} ${row.entityId?.slice(0, 8) ?? ''}` : '—',
    },
    {
      key: 'createdAt',
      header: 'Time',
      render: (row: AuditLog) => <span className="text-xs text-slate-400">{formatRelativeTime(row.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tenants</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={tenantColumns}
            data={(tenants?.data ?? []).map((t) => ({ ...t }))}
            isLoading={tenantsLoading}
            emptyMessage="No tenants found."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Audit Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={auditColumns}
            data={(auditLogs?.data ?? []).map((l) => ({ ...l }))}
            isLoading={logsLoading}
            emptyMessage="No audit logs."
          />
        </CardContent>
      </Card>
    </div>
  );
}
