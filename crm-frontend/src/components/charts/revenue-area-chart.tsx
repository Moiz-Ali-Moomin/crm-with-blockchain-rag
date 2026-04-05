'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';
import type { RevenueDataPoint } from '@/types';

interface Props {
  data: RevenueDataPoint[];
  height?: number;
}

export function RevenueAreaChart({ data, height = 240 }: Props) {
  if (!data.length) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-slate-400 text-sm">
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip formatter={(v: number) => formatCurrency(v)} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#6366f1"
          fill="url(#revenueGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
