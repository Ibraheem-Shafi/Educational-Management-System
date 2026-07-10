import type { CountWithTrend } from '../common/stats-metric';

export interface LearningStatsResponse {
  published: CountWithTrend;
  drafts: CountWithTrend;
  homework: CountWithTrend;
  dueSoon: CountWithTrend;
}
