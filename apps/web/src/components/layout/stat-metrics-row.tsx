import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendBadge } from './trend-badge';

export interface StatMetric {
  label: string;
  value: ReactNode;
  changePercent?: number | null;
  subtext?: ReactNode;
}

function StatMetricDivider({ className }: { className?: string }) {
  return (
    <div className={cn('flex shrink-0 items-center self-stretch py-4', className)} aria-hidden>
      <div className="h-[70%] min-h-[48px] w-px bg-stroke-soft-200" />
    </div>
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
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        {metrics.map((metric, index) => (
          <div key={metric.label} className="flex min-w-0 flex-1 flex-col lg:flex-row">
            {index > 0 && (
              <>
                <div className="flex justify-center px-5 lg:hidden" aria-hidden>
                  <div className="h-px w-[80%] bg-stroke-soft-200" />
                </div>
                <StatMetricDivider className="hidden lg:flex" />
              </>
            )}
            <div className="relative flex min-w-0 flex-1 flex-col items-center gap-1 px-5 py-4 text-center lg:items-start lg:px-6 lg:text-left">
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
          </div>
        ))}
      </div>
    </div>
  );
}
