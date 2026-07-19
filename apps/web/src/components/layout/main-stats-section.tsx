import type { CSSProperties, ReactNode } from 'react';
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

function statsGridStyle(count: number): CSSProperties {
  return { ['--stats-count' as string]: String(Math.max(count, 1)) };
}

function statsGridClassName(className?: string) {
  return cn(
    'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(var(--stats-count),minmax(0,1fr))]',
    className,
  );
}

function cellBorderClassName(index: number) {
  return cn(
    // Phone: stack with top borders between rows
    index > 0 && 'border-t border-[#E2E4E9]',
    // Tablet / small laptop: 2×2 — left border on odd cells, top border on second row
    'sm:border-[#E2E4E9]',
    index > 0 && 'sm:border-t-0',
    index >= 2 && 'sm:border-t',
    index % 2 === 1 && 'sm:border-l',
    // Desktop: single row — left border between cells only
    'lg:border-t-0',
    index > 0 && 'lg:border-l',
  );
}

function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="py-[11px]" style={dashedBorderStyle}>
      <div className={statsGridClassName('gap-0')} style={statsGridStyle(count)}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex min-w-0 flex-col items-center gap-2 px-4 py-2 lg:items-start',
              cellBorderClassName(i),
            )}
          >
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
      <div className={statsGridClassName()} style={statsGridStyle(stats.length)}>
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={cn(
              'flex min-w-0 flex-col items-center gap-1 px-4 py-2 text-center lg:items-start lg:px-5 lg:text-left',
              cellBorderClassName(index),
            )}
          >
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
        ))}
      </div>
    </div>
  );
}
