import type { CountWithTrend } from '../common/stats-metric';

export interface AttendanceStatsResponse {
  todayRate: CountWithTrend;
  monthAverage: CountWithTrend;
  presentToday: CountWithTrend;
  absentToday: CountWithTrend;
}

export interface AttendanceTrendResponse {
  points: Array<{ label: string; value: number }>;
  changePercent: number | null;
}
