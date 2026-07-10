import type { CountWithTrend } from '../common/stats-metric';

export interface AcademicStatsResponse {
  programs: CountWithTrend;
  batches: CountWithTrend;
  subjects: CountWithTrend;
  sessions: CountWithTrend;
}
