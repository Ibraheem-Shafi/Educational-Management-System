import type { CountWithTrend } from '../common/stats-metric';

export interface NoticesStatsResponse {
  published: CountWithTrend;
  draft: CountWithTrend;
  scheduled: CountWithTrend;
  totalViews: CountWithTrend;
}
