'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { analyticsApi } from '@/lib/api/analytics.api';
import { queryKeys } from '@/lib/query/query-keys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/crm/data-table';
import { formatCurrency } from '@/lib/utils';
import type { SalesRepPerformance } from '@/types';

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6'];

export default function AnalyticsPage() {
  const { data: revenue } = useQuery({ queryKey: queryKeys.analytics.revenue, queryFn: () => analyticsApi.getRevenue() });
  const { data: leadSources } = useQuery({ queryKey: queryKeys.analytics.leadSources, queryFn: analyticsApi.getLeadSources });
  const { data: funnel } = useQuery({ queryKey: queryKeys.analytics.pipelineFunnel, queryFn: () => analyticsApi.getPipelineFunnel() });
  const { data: salesPerf } = useQuery({ queryKey: queryKeys.analytics.salesPerformance, queryFn: () => analyticsApi.getSalesPerformance() });

  const salesColumns = [
    { key: 'name', header: 'Rep', render: (row: SalesRepPerformance) => <span className="font-medium">{row.name}</span> },
    { key: 'dealsWon', header: 'Deals Won', render: (row: SalesRepPerformance) => row.dealsWon },
    { key: 'revenue', header: 'Revenue', render: (row: SalesRepPerformance) => <span className="text-green-600 font-medium">{formatCurrency(row.revenue)}</span> },
    { key: 'leadsConverted', header: 'Leads Converted', render: (row: SalesRepPerformance) => row.leadsConverted },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue */}
        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-base">Revenue Over Time</CardTitle></CardHeader>
          <CardContent className="pt-4">
            {revenue?.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={revenue}>
                  <defs>
                    <linearGradient id="rev2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#rev2)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="h-60 flex items-center justify-center text-slate-400 text-sm">No data</div>}
          </CardContent>
        </Card>

        {/* Lead Sources */}
        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-base">Lead Sources</CardTitle></CardHeader>
          <CardContent className="pt-4">
            {leadSources?.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={leadSources} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {leadSources.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-60 flex items-center justify-center text-slate-400 text-sm">No data</div>}
          </CardContent>
        </Card>

        {/* Pipeline Funnel */}
        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-base">Pipeline Funnel</CardTitle></CardHeader>
          <CardContent className="pt-4">
            {funnel?.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={funnel} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="stage" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-60 flex items-center justify-center text-slate-400 text-sm">No data</div>}
          </CardContent>
        </Card>

        {/* Sales Performance */}
        <Card>
          <CardHeader className="pb-0"><CardTitle className="text-base">Sales Performance</CardTitle></CardHeader>
          <CardContent className="pt-4">
            <DataTable
              columns={salesColumns}
              data={(salesPerf ?? []).map((r, i) => ({ ...r, id: r.userId || String(i) }))}
              emptyMessage="No performance data."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
