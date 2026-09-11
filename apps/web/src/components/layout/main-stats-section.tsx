import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutGrid,
  UserRound,
  UserX,
  Users,
  Wallet,
} from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { accentForLabel, paletteColor, paletteSoft } from '@/lib/ui-palette';
import { cn } from '@/lib/utils';
import { TrendBadge } from './trend-badge';

export interface MainStatItem {
  label: string;
  value: ReactNode;
  /** Full value shown on hover (app tooltip). */
  title?: string;
  changePercent?: number | null;
}

export type MainStatsVariant = 'accent' | 'filled';

function iconForLabel(label: string): LucideIcon {
  const lower = label.toLowerCase();
  if (lower.includes('branch')) return Building2;
  if (lower.includes('student')) return GraduationCap;
  if (lower.includes('teacher') || lower.includes('staff')) return BookOpen;
  if (lower.includes('class') || lower.includes('batch')) return LayoutGrid;
  if (lower.includes('parent')) return Users;
  if (lower.includes('user')) return UserRound;
  if (lower.includes('absent')) return UserX;
  if (lower.includes('present') || lower.includes('attendance') || lower.includes('rate')) {
    return ClipboardCheck;
  }
  if (lower.includes('outstanding') || lower.includes('overdue') || lower.includes('fee')) {
    return Wallet;
  }
  if (lower.includes('collect') || lower.includes('invoice') || lower.includes('revenue')) {
    return Banknote;
  }
  if (lower.includes('file') || lower.includes('document') || lower.includes('report')) {
    return FileText;
  }
  return BarChart3;
}

function statsGridStyle(count: number): CSSProperties {
  return { ['--stats-count' as string]: String(Math.max(count, 1)) };
}

function statsGridClassName(className?: string) {
  return cn(
    'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(var(--stats-count),minmax(0,1fr))]',
    className,
  );
}

function FilledSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={statsGridClassName('gap-3')} style={statsGridStyle(count)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-[108px] animate-pulse rounded-xl"
          style={{ backgroundColor: paletteColor(accentForLabel('', i)) }}
        />
      ))}
    </div>
  );
}

function AccentSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-stroke-soft-200 bg-neutral-0">
      <div className={statsGridClassName('gap-0')} style={statsGridStyle(count)}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex min-w-0 items-center gap-3 px-4 py-3',
              i > 0 && 'border-t border-stroke-soft-200 sm:border-t-0',
              i % 2 === 1 && 'sm:border-l sm:border-stroke-soft-200',
              i > 0 && 'lg:border-l lg:border-t-0 lg:border-stroke-soft-200',
            )}
          >
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-[var(--neutral-50)]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-[var(--neutral-50)]" />
              <div className="h-7 w-16 animate-pulse rounded bg-[var(--neutral-50)]" />
            </div>
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
  variant = 'filled',
}: {
  stats: MainStatItem[];
  className?: string;
  isLoading?: boolean;
  skeletonCount?: number;
  variant?: MainStatsVariant;
}) {
  const count = skeletonCount ?? (stats.length || 4);

  if (isLoading) {
    return (
      <div className={className}>
        {variant === 'filled' ? <FilledSkeleton count={count} /> : <AccentSkeleton count={count} />}
      </div>
    );
  }

  if (variant === 'filled') {
    return (
      <div
        className={statsGridClassName(cn('gap-3', className))}
        style={statsGridStyle(stats.length)}
      >
        {stats.map((stat, index) => {
          const accent = accentForLabel(stat.label, index);
          const Icon = iconForLabel(stat.label);
          return (
            <div
              key={stat.label}
              className="flex min-w-0 flex-col justify-between rounded-xl p-4 text-white shadow-[0_8px_20px_rgba(11,31,58,0.08)]"
              style={{ backgroundColor: paletteColor(accent) }}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
                  <Icon className="h-4 w-4 text-white" strokeWidth={1.75} />
                </span>
                <TrendBadge changePercent={stat.changePercent} onFilled />
              </div>
              <div className="mt-3 min-w-0">
                <p className="truncate text-xs font-medium leading-4 text-white/80">{stat.label}</p>
                <Tooltip content={stat.title} className="w-full min-w-0">
                  <p className="mt-0.5 w-full min-w-0 truncate text-2xl font-semibold leading-8 tracking-tight">
                    {stat.value}
                  </p>
                </Tooltip>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn('overflow-hidden rounded-xl border border-stroke-soft-200 bg-neutral-0', className)}
    >
      <div className={statsGridClassName('gap-0')} style={statsGridStyle(stats.length)}>
        {stats.map((stat, index) => {
          const accent = accentForLabel(stat.label, index);
          const Icon = iconForLabel(stat.label);
          return (
            <div
              key={stat.label}
              className={cn(
                'flex min-w-0 items-center gap-3 px-4 py-3',
                index > 0 && 'border-t border-stroke-soft-200 sm:border-t-0',
                index % 2 === 1 && 'sm:border-l sm:border-stroke-soft-200',
                index > 0 && 'lg:border-l lg:border-t-0 lg:border-stroke-soft-200',
              )}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: paletteSoft(accent),
                  color: paletteColor(accent),
                }}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex w-full min-w-0 items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium leading-5 text-[var(--base-muted-foreground)]">
                    {stat.label}
                  </p>
                  <TrendBadge changePercent={stat.changePercent} />
                </div>
                <Tooltip content={stat.title} className="w-full min-w-0">
                  <p className="w-full min-w-0 truncate text-2xl font-semibold leading-8 tracking-tight text-[var(--base-foreground)]">
                    {stat.value}
                  </p>
                </Tooltip>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
