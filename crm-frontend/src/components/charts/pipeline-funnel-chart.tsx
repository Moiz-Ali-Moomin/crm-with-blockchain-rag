'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { PipelineFunnelStage } from '@/types';

interface Props {
  data: PipelineFunnelStage[];
  height?: number;
}

export function PipelineFunnelChart({ data, height = 240 }: Props) {
  if (!data.length) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-slate-400 text-sm">
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis dataKey="stage" type="category" tick={{ fontSize: 11 }} width={80} />
        <Tooltip />
        <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
