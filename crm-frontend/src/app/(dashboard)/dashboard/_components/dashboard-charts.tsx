'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { analyticsApi } from '@/lib/api/analytics.api';
import { queryKeys } from '@/lib/query/query-keys';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/ui/glass-card';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, PieChartIcon, Loader2 } from 'lucide-react';

const PIE_COLORS = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316',
];

// ── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomAreaTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-elevated rounded-xl px-3 py-2 text-sm">
      <p className="text-white/50 text-xs mb-1">{label}</p>
      <p className="text-white font-semibold">{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

function CustomPieTooltip({
  active, payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-elevated rounded-xl px-3 py-2 text-sm">
      <p className="text-white/60 text-xs">{payload[0].name}</p>
      <p className="text-white font-semibold">{payload[0].value.toLocaleString()}</p>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="h-56 flex flex-col items-center justify-center gap-2 text-white/25">
      <PieChartIcon size={28} strokeWidth={1} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

// ── Skeleton bars inside chart area ─────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="h-56 flex items-end gap-2 px-2">
      {[60, 80, 45, 90, 70, 55, 85, 40, 75, 65, 50, 88].map((h, i) => (
        <div
          key={i}
          className="flex-1 glass-skeleton rounded-t-md"
          style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }}
        />
      ))}
    </div>
  );
}

// ── Revenue chart ────────────────────────────────────────────────────────────

function RevenueChart() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.analytics.revenue,
    queryFn:  () => analyticsApi.getRevenue(),
  });

  return (
    <GlassCard variant="default" padding="md" className="h-full">
      <GlassCardHeader>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-500/20 text-violet-300">
            <TrendingUp size={14} strokeWidth={2} />
          </div>
          <GlassCardTitle>Revenue</GlassCardTitle>
        </div>
        <span className="text-[11px] text-white/30 font-medium">12 months</span>
      </GlassCardHeader>

      <GlassCardContent>
        {isLoading ? (
          <ChartSkeleton />
        ) : !data?.length ? (
          <ChartEmpty label="No revenue data yet" />
        ) : (
          <ResponsiveContainer width="100%" height={224}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomAreaTooltip />} cursor={{ stroke: 'rgba(139,92,246,0.25)', strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#revGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#8b5cf6', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </GlassCardContent>
    </GlassCard>
  );
}

// ── Lead Sources pie ─────────────────────────────────────────────────────────

function LeadSourcesChart() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.analytics.leadSources,
    queryFn:  analyticsApi.getLeadSources,
  });

  return (
    <GlassCard variant="default" padding="md" className="h-full">
      <GlassCardHeader>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300">
            <PieChartIcon size={14} strokeWidth={2} />
          </div>
          <GlassCardTitle>Lead Sources</GlassCardTitle>
        </div>
      </GlassCardHeader>

      <GlassCardContent>
        {isLoading ? (
          <div className="h-56 flex items-center justify-center">
            <Loader2 size={24} className="text-violet-400 animate-spin" />
          </div>
        ) : !data?.length ? (
          <ChartEmpty label="No source data yet" />
        ) : (
          <ResponsiveContainer width="100%" height={224}>
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="source"
                cx="50%"
                cy="45%"
                outerRadius={80}
                innerRadius={44}
                paddingAngle={2}
                label={false}
              >
                {data.map((_, i) => (
                  <Cell
                    key={i}
                    fill={PIE_COLORS[i % PIE_COLORS.length]}
                    opacity={0.9}
                  />
                ))}
              </Pie>
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value: string) =>
                  <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>
                    {value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                  </span>
                }
              />
              <Tooltip content={<CustomPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </GlassCardContent>
    </GlassCard>
  );
}

// ── Composed export ──────────────────────────────────────────────────────────

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export function DashboardCharts() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full"
    >
      <motion.div variants={itemVariants}>
        <RevenueChart />
      </motion.div>
      <motion.div variants={itemVariants}>
        <LeadSourcesChart />
      </motion.div>
    </motion.div>
  );
}
