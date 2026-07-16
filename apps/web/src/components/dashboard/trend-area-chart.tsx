'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface TrendChartPoint {
  label: string;
  value: number;
}

export function TrendAreaChart({
  title,
  subtitle,
  data,
  totalLabel,
  totalValue,
  changePercent,
  isLoading,
  valueFormatter,
  gradientId = 'trendAreaGradient',
  height = 220,
}: {
  title: string;
  subtitle?: string;
  data: TrendChartPoint[];
  totalLabel?: string;
  totalValue?: string;
  changePercent?: number | null;
  isLoading?: boolean;
  valueFormatter?: (value: number) => string;
  gradientId?: string;
  height?: number;
}) {
  const formatValue = valueFormatter ?? ((v: number) => v.toLocaleString('en-US'));

  if (isLoading) {
    return (
      <div className="rounded-xl border border-stroke-soft-200 bg-neutral-0 p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-7 w-20" />
        </div>
        <Skeleton className="w-full rounded-lg" style={{ height }} />
      </div>
    );
  }

  const chartData = data.map((point) => ({ label: point.label, value: point.value }));
  const maxVal = Math.max(...chartData.map((p) => p.value), 1);
  const yMax = Math.ceil(maxVal / 4) * 4 || 4;
  const yTicks = Array.from({ length: 5 }, (_, i) => (yMax / 4) * i);
  const trendLabel =
    changePercent !== undefined && changePercent !== null
      ? `${changePercent > 0 ? '+' : ''}${changePercent}% vs prior period`
      : null;
  const isPositiveTrend = (changePercent ?? 0) >= 0;

  return (
    <div className="rounded-xl border border-stroke-soft-200 bg-neutral-0 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium leading-6 text-[var(--text-main-900)]">{title}</h3>
          {subtitle && (
            <p className="text-sm font-normal leading-5 text-[var(--text-sub-500)]">{subtitle}</p>
          )}
        </div>
        {(totalValue || totalLabel) && (
          <div className="text-right">
            {totalValue && (
              <p className="text-xl font-semibold leading-7 tracking-[-0.02em] text-[var(--text-main-900)]">
                {totalValue}
              </p>
            )}
            {trendLabel && (
              <p
                className={cn(
                  'mt-0.5 inline-flex items-center justify-end gap-1 text-xs font-medium leading-4',
                  isPositiveTrend ? 'text-[#16A34A]' : 'text-[#DC2626]',
                )}
              >
                {isPositiveTrend && <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
                {trendLabel}
              </p>
            )}
            {totalLabel && !totalValue && (
              <p className="text-sm text-[var(--text-sub-500)]">{totalLabel}</p>
            )}
          </div>
        )}
      </div>

      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00A5FF" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#CEF0FF" stopOpacity={0.09} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--stroke-soft-200, #E2E4E9)" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'var(--text-soft-400, #868C98)' }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              ticks={yTicks}
              domain={[0, yMax]}
              tick={{ fontSize: 12, fill: 'var(--text-soft-400, #868C98)' }}
            />
            <Tooltip
              formatter={(value: number) => [formatValue(value), title]}
              labelFormatter={(label) => label}
              contentStyle={{
                borderRadius: 8,
                border: '1px solid var(--stroke-soft-200, #E2E4E9)',
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#003E73"
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: '#003E73' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
