import type { CountWithTrend } from '../common/stats-metric';

export interface CommunicationsStatsResponse {
  sentLast30Days: CountWithTrend;
  failedLast30Days: CountWithTrend;
  smsCount: CountWithTrend;
  whatsappCount: CountWithTrend;
}
