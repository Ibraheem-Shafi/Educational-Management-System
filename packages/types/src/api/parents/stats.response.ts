import type { CountWithTrend } from '../common/stats-metric';

export interface ParentsStatsResponse {
  totalParents: CountWithTrend;
  linkedStudents: CountWithTrend;
  unlinkedParents: CountWithTrend;
  newLast30Days: CountWithTrend;
}
