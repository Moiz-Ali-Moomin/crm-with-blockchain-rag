'use client';

import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { LeadSourceData } from '@/types';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6'];

interface Props {
  data: LeadSourceData[];
  height?: number;
}

export function LeadSourcePieChart({ data, height = 240 }: Props) {
  if (!data.length) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-slate-400 text-sm">
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="source"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Legend wrapperStyle={{ fontSize: '11px' }} />
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
