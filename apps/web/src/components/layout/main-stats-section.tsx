import type { CSSProperties, ReactNode } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TrendBadge } from './trend-badge';

export interface MainStatItem {
  label: string;
  value: ReactNode;
  /** Full value shown on hover (app tooltip). */
  title?: string;
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
                'flex min-w-0 flex-col items-center gap-1 px-3 py-2 text-center sm:px-4 lg:items-start lg:px-5 lg:text-left',
                cellBorderClassName(index),
              )}
            >
              <div className="flex w-full min-w-0 items-start justify-center gap-2 lg:justify-between">
                <p className="min-w-0 truncate text-sm font-medium leading-5 text-[var(--base-muted-foreground)]">
                  {stat.label}
                </p>
                {stat.changePercent != null && (
                  <TrendBadge changePercent={stat.changePercent} />
                )}
              </div>
              <Tooltip content={stat.title} className="w-full min-w-0">
                <p className="w-full min-w-0 truncate text-2xl font-semibold leading-8 tracking-tight text-[var(--base-foreground)] sm:text-[1.75rem] sm:leading-9 lg:text-3xl">
                  {stat.value}
                </p>
              </Tooltip>
            </div>
          ))}
      </div>
    </div>
  );
}
