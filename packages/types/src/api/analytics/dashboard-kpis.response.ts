import type { MetricWithTrend, NullableMetricWithTrend } from '../common/metric-with-trend';

export interface AnalyticsDashboardKpisResponse {
  assessmentsLast30Days: MetricWithTrend;
  attendanceRecordsLast30Days: number;
  attendanceRateLast30Days: MetricWithTrend;
  averageAssessmentPercentage: NullableMetricWithTrend;
}
