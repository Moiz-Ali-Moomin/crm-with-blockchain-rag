import { apiGet } from './client';
import type {
  DashboardMetrics,
  RevenueDataPoint,
  LeadSourceData,
  PipelineFunnelStage,
  SalesRepPerformance,
} from '@/types';

export const analyticsApi = {
  getDashboard: () => apiGet<DashboardMetrics>('/analytics/dashboard'),

  getRevenue: (params?: { period?: string; year?: number }) =>
    apiGet<RevenueDataPoint[]>('/analytics/revenue', params),

  getLeadSources: () => apiGet<LeadSourceData[]>('/analytics/lead-sources'),

  getSalesPerformance: (params?: { period?: string }) =>
    apiGet<SalesRepPerformance[]>('/analytics/sales-performance', params),

  getPipelineFunnel: (pipelineId?: string) =>
    apiGet<PipelineFunnelStage[]>('/analytics/pipeline-funnel', {
      pipelineId,
    }),
};
