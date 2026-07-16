import type { CountWithTrend } from '../common/stats-metric';

export interface FeesStatsResponse {
  outstandingAmount: CountWithTrend;
  collectedLast30Days: CountWithTrend;
  overdueCount: CountWithTrend;
  invoicesIssued: CountWithTrend;
}

export interface FeesRevenueTrendResponse {
  points: Array<{ label: string; value: number }>;
  changePercent: number | null;
}
