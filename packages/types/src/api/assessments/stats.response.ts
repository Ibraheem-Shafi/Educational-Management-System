import type { CountWithTrend } from '../common/stats-metric';

export interface AssessmentsStatsResponse {
  activeAssessments: CountWithTrend;
  completedAssessments: CountWithTrend;
  averageScore: CountWithTrend;
  pendingMarks: CountWithTrend;
}
