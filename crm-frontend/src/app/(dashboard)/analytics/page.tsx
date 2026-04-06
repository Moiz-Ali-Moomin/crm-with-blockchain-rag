'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { analyticsApi } from '@/lib/api/analytics.api';
import { queryKeys } from '@/lib/query/query-keys';
import { formatCurrency, cn } from '@/lib/utils';
import {
  TrendingUp, PieChart as PieIcon, BarChart2, Users,
  DollarSign, Percent, Award, Loader2,
} from 'lucide-react';
import type { SalesRepPerformance } from '@/types';

// ─── Design tokens ────────────────────────────────────────────────────────────

const PIE_COLORS  = ['#8b5cf6', '#22d3ee', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#f97316'];
const FUNNEL_COLOR = 'url(#funnelGrad)';

// ─── Custom Tooltips ──────────────────────────────────────────────────────────

function AreaTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-elevated rounded-xl px-3.5 py-2.5 text-sm border border-violet-400/20">
      <p className="text-white/40 text-xs mb-1">{label}</p>
      <p className="text-violet-300 font-bold text-base">{formatCurrency(payload[0].value)}</p>
      {payload[1] && <p className="text-cyan-300 text-xs mt-0.5">{payload[1].value} deals</p>}
    </div>
  );
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-elevated rounded-xl px-3.5 py-2.5 text-sm border border-cyan-400/20">
      <p className="text-white/40 text-xs mb-1">{label}</p>
      <p className="text-cyan-300 font-bold">{payload[0].value} deals</p>
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-elevated rounded-xl px-3.5 py-2.5 text-sm">
      <p className="text-white/60 text-xs">{payload[0].name?.replace(/_/g, ' ')}</p>
      <p className="text-white font-bold">{payload[0].value.toLocaleString()}</p>
      <p className="text-white/40 text-xs">{payload[0].payload.percentage}%</p>
    </div>
  );
}

// ─── Skeleton / Empty ─────────────────────────────────────────────────────────

function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div className="flex items-end gap-1.5 px-2" style={{ height }}>
      {[55, 75, 42, 88, 68, 52, 82, 38, 72, 62, 48, 85].map((h, i) => (
        <div key={i} className="flex-1 glass-skeleton rounded-t-md" style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }} />
      ))}
    </div>
  );
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-white/20" style={{ height: 240 }}>
      <BarChart2 size={28} strokeWidth={1} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

// ─── Glass Card shell ─────────────────────────────────────────────────────────

function ChartCard({
  title, subtitle, icon, iconColor = 'violet', children, className,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconColor?: 'violet' | 'cyan' | 'emerald' | 'amber';
  children: React.ReactNode;
  className?: string;
}) {
  const iconBg: Record<string, string> = {
    violet:  'bg-violet-500/20 text-violet-300',
    cyan:    'bg-cyan-500/20 text-cyan-300',
    emerald: 'bg-emerald-500/20 text-emerald-300',
    amber:   'bg-amber-500/20 text-amber-300',
  };
  return (
    <div className={cn('glass rounded-2xl overflow-hidden flex flex-col', className)}>
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn('p-2 rounded-xl', iconBg[iconColor])}>{icon}</div>
          <div>
            <p className="text-sm font-semibold text-white/85">{title}</p>
            {subtitle && <p className="text-[11px] text-white/30 mt-0.5">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="px-5 pb-5 flex-1">{children}</div>
    </div>
  );
}

// ─── KPI strip ────────────────────────────────────────────────────────────────

interface KpiItem {
  label: string;
  value: string;
  sub: string;
  gradient: string;
  border: string;
  icon: React.ReactNode;
}

function KpiCard({ item, index }: { item: KpiItem; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      className={cn('relative overflow-hidden rounded-2xl border p-5 bg-gradient-to-br backdrop-blur-xl', item.gradient, item.border)}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">{item.label}</p>
        <div className="opacity-50">{item.icon}</div>
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{item.value}</p>
      <p className="text-xs text-white/35 mt-1.5">{item.sub}</p>
    </motion.div>
  );
}

// ─── Revenue chart ────────────────────────────────────────────────────────────

function RevenueChart() {
  const { data, isLoading } = useQuery({ queryKey: queryKeys.analytics.revenue, queryFn: () => analyticsApi.getRevenue() });

  return (
    <ChartCard title="Revenue" subtitle="Monthly won-deal value" icon={<TrendingUp size={14} />} iconColor="violet" className="h-full">
      {isLoading ? <ChartSkeleton /> : !data?.length ? <ChartEmpty label="No revenue data" /> : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.55} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="dealFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<AreaTooltip />} cursor={{ stroke: 'rgba(139,92,246,0.2)', strokeWidth: 1 }} />
            <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#revFill)" dot={false} activeDot={{ r: 4, fill: '#8b5cf6', strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// ─── Lead Sources donut ───────────────────────────────────────────────────────

function LeadSourcesChart() {
  const { data, isLoading } = useQuery({ queryKey: queryKeys.analytics.leadSources, queryFn: analyticsApi.getLeadSources });

  return (
    <ChartCard title="Lead Sources" subtitle="Acquisition breakdown" icon={<PieIcon size={14} />} iconColor="cyan" className="h-full">
      {isLoading ? (
        <div className="flex items-center justify-center" style={{ height: 240 }}>
          <Loader2 size={24} className="animate-spin text-cyan-400" />
        </div>
      ) : !data?.length ? <ChartEmpty label="No source data" /> : (
        <div className="flex items-center gap-4">
          <ResponsiveContainer width="55%" height={220}>
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={82} innerRadius={46} paddingAngle={2} startAngle={90} endAngle={-270}>
                {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} opacity={0.9} />)}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex-1 space-y-2 min-w-0">
            {data.slice(0, 6).map((item, i) => (
              <div key={i} className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-[11px] text-white/50 truncate flex-1">
                  {item.source.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                </span>
                <span className="text-[11px] text-white/30 shrink-0">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

// ─── Pipeline Funnel ──────────────────────────────────────────────────────────

function PipelineFunnelChart() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.analytics.pipelineFunnel,
    queryFn:  () => analyticsApi.getPipelineFunnel(),
  });

  return (
    <ChartCard title="Pipeline Funnel" subtitle="Open deals per stage" icon={<BarChart2 size={14} />} iconColor="emerald" className="h-full">
      {isLoading ? <ChartSkeleton height={200} /> : !data?.length ? <ChartEmpty label="No pipeline data" /> : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="funnelGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
            <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis dataKey="stage" type="category" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11 }} axisLine={false} tickLine={false} width={88} />
            <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="count" fill={FUNNEL_COLOR} radius={[0, 6, 6, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

// ─── Sales Performance ────────────────────────────────────────────────────────

function SalesPerformance() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.analytics.salesPerformance,
    queryFn:  () => analyticsApi.getSalesPerformance(),
  });

  const AVATAR_GRADIENTS = ['from-violet-500 to-purple-700', 'from-cyan-500 to-blue-600', 'from-emerald-500 to-teal-700', 'from-rose-500 to-pink-700'];

  return (
    <ChartCard title="Sales Performance" subtitle="Top reps this month" icon={<Award size={14} />} iconColor="amber" className="h-full">
      {isLoading ? (
        <div className="space-y-3 mt-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full glass-skeleton shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-28 glass-skeleton rounded-full" />
                <div className="h-2 w-16 glass-skeleton rounded-full" />
              </div>
              <div className="h-3 w-16 glass-skeleton rounded-full" />
            </div>
          ))}
        </div>
      ) : !data?.length ? (
        <div className="flex flex-col items-center justify-center gap-2 text-white/20 py-12">
          <Users size={24} strokeWidth={1} />
          <span className="text-sm">No performance data</span>
        </div>
      ) : (
        <div className="space-y-2.5 mt-1">
          {(data as SalesRepPerformance[]).map((rep, i) => {
            const maxRevenue = data[0].revenue || 1;
            const barWidth   = Math.round((rep.revenue / maxRevenue) * 100);
            return (
              <div key={rep.userId} className="group">
                <div className="flex items-center gap-3 mb-1.5">
                  <div className={cn(
                    'w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-[10px] font-bold text-white shrink-0',
                    AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
                  )}>
                    {rep.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white/80 truncate">{rep.name}</span>
                      <span className="text-xs font-semibold text-emerald-400 shrink-0 ml-2">{formatCurrency(rep.revenue)}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] text-white/30">{rep.dealsWon} deals won</span>
                    </div>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1 bg-white/5 rounded-full overflow-hidden ml-10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ delay: i * 0.1 + 0.3, duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, #8b5cf6, #22d3ee)` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data: revenue } = useQuery({ queryKey: queryKeys.analytics.revenue, queryFn: () => analyticsApi.getRevenue() });
  const { data: salesPerf } = useQuery({ queryKey: queryKeys.analytics.salesPerformance, queryFn: () => analyticsApi.getSalesPerformance() });

  const totalRevenue   = revenue?.reduce((s, r) => s + r.revenue, 0) ?? 0;
  const totalDeals     = revenue?.reduce((s, r) => s + r.deals,   0) ?? 0;
  const avgDeal        = totalDeals > 0 ? totalRevenue / totalDeals : 0;
  const topRepRevenue  = (salesPerf as SalesRepPerformance[] | undefined)?.[0]?.revenue ?? 0;

  const kpis: KpiItem[] = [
    {
      label: '6-Month Revenue',
      value: formatCurrency(totalRevenue),
      sub: `${totalDeals} deals closed`,
      gradient: 'from-violet-500/18 via-violet-600/8 to-transparent',
      border: 'border-violet-400/20',
      icon: <DollarSign size={16} className="text-violet-300" />,
    },
    {
      label: 'Deals Closed',
      value: totalDeals.toLocaleString(),
      sub: 'From revenue chart',
      gradient: 'from-cyan-500/18 via-cyan-600/8 to-transparent',
      border: 'border-cyan-400/20',
      icon: <TrendingUp size={16} className="text-cyan-300" />,
    },
    {
      label: 'Avg Deal Size',
      value: formatCurrency(avgDeal),
      sub: 'Revenue ÷ deals',
      gradient: 'from-emerald-500/18 via-emerald-600/8 to-transparent',
      border: 'border-emerald-400/20',
      icon: <Percent size={16} className="text-emerald-300" />,
    },
    {
      label: 'Top Rep Revenue',
      value: formatCurrency(topRepRevenue),
      sub: (salesPerf as SalesRepPerformance[] | undefined)?.[0]?.name ?? '—',
      gradient: 'from-amber-500/18 via-amber-600/8 to-transparent',
      border: 'border-amber-400/20',
      icon: <Award size={16} className="text-amber-300" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((item, i) => <KpiCard key={item.label} item={item} index={i} />)}
      </div>

      {/* Row 1: Revenue (wide) + Lead Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <RevenueChart />
        </div>
        <div className="lg:col-span-2">
          <LeadSourcesChart />
        </div>
      </div>

      {/* Row 2: Pipeline Funnel + Sales Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PipelineFunnelChart />
        <SalesPerformance />
      </div>
    </div>
  );
}
