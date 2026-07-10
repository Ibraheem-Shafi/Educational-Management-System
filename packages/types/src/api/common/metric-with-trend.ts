export interface MetricWithTrend {
  value: number;
  changePercent: number | null;
}

export interface NullableMetricWithTrend {
  value: number | null;
  changePercent: number | null;
}
