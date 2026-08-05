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
import { formatCurrency, formatCurrencyCompact } from '@eims/shared';
import type { DashboardMonthlyRevenueResponse } from '@eims/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip as AppTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function formatTrend(changePercent: number | null): string | null {
  if (changePercent === null) return null;
  const sign = changePercent > 0 ? '+' : '';
  return `${sign}${changePercent}% vs last year`;
}

export function MonthlyRevenueCard({
  data,
  isLoading,
}: {
  data?: DashboardMonthlyRevenueResponse;
  isLoading?: boolean;
  currency?: string;
}) {
  if (isLoading || !data) {
    return (
      <div className="rounded-xl border border-stroke-soft-200 bg-neutral-0 p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-2 text-right">
            <Skeleton className="ml-auto h-7 w-20" />
            <Skeleton className="ml-auto h-4 w-28" />
          </div>
        </div>
        <Skeleton className="h-[220px] w-full rounded-lg" />
      </div>
    );
  }

  const chartData = data.months.map((month) => ({
    label: month.label,
    amount: month.amount,
    amountLakh: Math.round((month.amount / 100_000) * 100) / 100,
  }));

  const maxLakh = Math.max(...chartData.map((point) => point.amountLakh), 1);
  const yMax = Math.ceil(maxLakh / 2) * 2 || 10;
  const yTicks = Array.from({ length: 5 }, (_, i) => (yMax / 4) * i);
  const trendLabel = formatTrend(data.changePercentVsLastYear);
  const isPositiveTrend = (data.changePercentVsLastYear ?? 0) >= 0;

  return (
    <div className="rounded-xl border border-stroke-soft-200 bg-neutral-0 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-medium leading-6 text-[var(--text-main-900)]">
            Monthly Revenue
          </h3>
          <p className="text-sm font-normal leading-5 text-[var(--text-sub-500)]">
            Fiscal year {data.fiscalYear}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <AppTooltip content={formatCurrency(data.totalAmount)} className="justify-end">
            <p className="truncate text-xl font-semibold leading-7 tracking-[-0.02em] text-[var(--text-main-900)]">
              {formatCurrencyCompact(data.totalAmount)}
            </p>
          </AppTooltip>
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
        </div>
      </div>

      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="dashboardRevenueGradient" x1="0" y1="0" x2="0" y2="1">
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
              tickFormatter={(v) => `${v}L`}
            />
            <Tooltip
              formatter={(value: number, _name: string, item) => [
                formatCurrency(Number(item?.payload?.amount ?? value * 100_000)),
                'Revenue',
              ]}
              labelFormatter={(label) => label}
              contentStyle={{
                borderRadius: 8,
                border: '1px solid var(--stroke-soft-200, #E2E4E9)',
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="amountLakh"
              stroke="#003E73"
              strokeWidth={2.5}
              fill="url(#dashboardRevenueGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#003E73' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
