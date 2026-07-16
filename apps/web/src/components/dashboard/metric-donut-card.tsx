'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { AttendanceDonut } from './attendance-donut';

export interface DonutSegment {
  label: string;
  rate: number;
  color: string;
}

export function MetricDonutCard({
  title,
  subtitle,
  segments,
  isLoading,
}: {
  title: string;
  subtitle?: string;
  segments: DonutSegment[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-stroke-soft-200 bg-neutral-0 p-5">
        <Skeleton className="mb-4 h-5 w-40" />
        <div className="flex justify-around gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] w-[104px] rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stroke-soft-200 bg-neutral-0 p-5">
      <div className="mb-4">
        <h3 className="text-base font-medium leading-6 text-[var(--text-main-900)]">{title}</h3>
        {subtitle && (
          <p className="text-sm font-normal leading-5 text-[var(--text-sub-500)]">{subtitle}</p>
        )}
      </div>
      <div className="flex flex-wrap justify-around gap-6">
        {segments.map((segment) => (
          <div key={segment.label} className="flex flex-col items-center gap-2">
            <AttendanceDonut rate={segment.rate} color={segment.color} />
            <span className="text-sm text-[var(--text-sub-500)]">{segment.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
