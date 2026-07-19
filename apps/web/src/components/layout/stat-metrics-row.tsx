import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendBadge } from './trend-badge';

export interface StatMetric {
  label: string;
  value: ReactNode;
  changePercent?: number | null;
  subtext?: ReactNode;
}

function statsGridStyle(count: number): CSSProperties {
  return { ['--stats-count' as string]: String(Math.max(count, 1)) };
}

function cellBorderClassName(index: number) {
  return cn(
    index > 0 && 'border-t border-stroke-soft-200',
    'sm:border-stroke-soft-200',
    index > 0 && 'sm:border-t-0',
    index >= 2 && 'sm:border-t',
    index % 2 === 1 && 'sm:border-l',
    'lg:border-t-0',
    index > 0 && 'lg:border-l',
  );
}

export function StatMetricsRow({
  metrics,
  className,
}: {
  metrics: StatMetric[];
  className?: string;
}) {
  return (
    <div className={cn('rounded-xl border border-stroke-soft-200 bg-neutral-0', className)}>
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(var(--stats-count),minmax(0,1fr))]"
        style={statsGridStyle(metrics.length)}
      >
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className={cn(
              'relative flex min-w-0 flex-col items-center gap-1 px-5 py-4 text-center lg:items-start lg:px-6 lg:text-left',
              cellBorderClassName(index),
            )}
          >
            <div className="flex items-start justify-center gap-2 lg:w-full lg:justify-between">
              <p className="text-sm font-medium leading-5 text-text-soft-400">{metric.label}</p>
              {metric.changePercent != null && (
                <TrendBadge changePercent={metric.changePercent} />
              )}
            </div>
            <p className="text-2xl font-semibold leading-8 tracking-[-0.02em] text-text-main-900">
              {metric.value}
            </p>
            {metric.subtext && (
              <p className="text-xs leading-4 text-text-sub-500">{metric.subtext}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
