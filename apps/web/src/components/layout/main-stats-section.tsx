import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { TrendBadge } from './trend-badge';

export interface MainStatItem {
  label: string;
  value: ReactNode;
  changePercent?: number | null;
}

const dashedBorderStyle = {
  backgroundImage: [
    'repeating-linear-gradient(to right, #E2E4E9 0 12px, transparent 12px 24px)',
    'repeating-linear-gradient(to right, #E2E4E9 0 12px, transparent 12px 24px)',
  ].join(', '),
  backgroundPosition: 'top left, bottom left',
  backgroundRepeat: 'repeat-x',
  backgroundSize: '100% 1px',
} as const;

function VerticalSeparator({ className }: { className?: string }) {
  return (
    <div className={cn('flex shrink-0 items-center self-stretch', className)} aria-hidden>
      <div className="h-[80%] min-h-[48px] w-px bg-[#E2E4E9]" />
    </div>
  );
}

function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2 py-[11px]" style={dashedBorderStyle}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-2 px-4 py-2 lg:items-start">
            <div className="h-4 w-24 animate-pulse rounded bg-[var(--neutral-50)]" />
            <div className="h-9 w-16 animate-pulse rounded bg-[var(--neutral-50)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MainStatsSection({
  stats,
  className,
  isLoading,
  skeletonCount,
}: {
  stats: MainStatItem[];
  className?: string;
  isLoading?: boolean;
  skeletonCount?: number;
}) {
  if (isLoading) {
    return (
      <div className={className}>
        <StatSkeleton count={skeletonCount ?? (stats.length || 4)} />
      </div>
    );
  }

  return (
    <div className={cn('py-[11px]', className)} style={dashedBorderStyle}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-2">
        {stats.map((stat, index) => (
          <div key={stat.label} className="flex min-w-0 flex-1 flex-col lg:flex-row">
            {index > 0 && (
              <>
                <div className="flex justify-center px-4 lg:hidden" aria-hidden>
                  <div className="h-px w-[80%] bg-[#E2E4E9]" />
                </div>
                <VerticalSeparator className="hidden lg:flex" />
              </>
            )}
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1 px-4 py-2 text-center lg:items-start lg:px-5 lg:text-left">
              <div className="flex items-start justify-center gap-2 lg:w-full lg:justify-between">
                <p className="text-sm font-medium leading-5 text-[var(--base-muted-foreground)]">
                  {stat.label}
                </p>
                {stat.changePercent != null && (
                  <TrendBadge changePercent={stat.changePercent} />
                )}
              </div>
              <p className="text-3xl font-semibold leading-9 text-[var(--base-foreground)]">
                {stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
