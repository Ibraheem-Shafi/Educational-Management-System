import type { CountWithTrend } from '../common/stats-metric';

export interface AuditStatsResponse {
  eventsLast24h: CountWithTrend;
  eventsLast7d: CountWithTrend;
  uniqueActors: CountWithTrend;
  topActionCount: CountWithTrend;
}
