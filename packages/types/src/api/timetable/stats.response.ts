import type { CountWithTrend } from '../common/stats-metric';

export interface TimetableStatsResponse {
  slotsPerWeek: CountWithTrend;
  roomsUsed: CountWithTrend;
  teachersScheduled: CountWithTrend;
  batchesScheduled: CountWithTrend;
}
