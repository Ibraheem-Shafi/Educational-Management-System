'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  BookOpen,
  Building2,
  CalendarCheck,
  FileText,
  UserPlus,
} from 'lucide-react';
import type { DashboardActivityKind, DashboardRecentActivitiesResponse } from '@eims/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const ACTIVITY_STYLES: Record<
  DashboardActivityKind,
  { icon: LucideIcon; iconBg: string; iconColor: string }
> = {
  student: { icon: UserPlus, iconBg: 'bg-[#EFF6FF]', iconColor: 'text-[#2563EB]' },
  teacher: { icon: BookOpen, iconBg: 'bg-[#ECFDF3]', iconColor: 'text-[#16A34A]' },
  fee: { icon: Banknote, iconBg: 'bg-[#FFF7ED]', iconColor: 'text-[#EA580C]' },
  attendance: { icon: CalendarCheck, iconBg: 'bg-[#ECFDF3]', iconColor: 'text-[#16A34A]' },
  branch: { icon: Building2, iconBg: 'bg-[#EFF6FF]', iconColor: 'text-[#2563EB]' },
  report: { icon: FileText, iconBg: 'bg-[#F4F4F5]', iconColor: 'text-[#71717A]' },
};

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function RecentActivitiesCard({
  data,
  isLoading,
  scopeLabel = 'Live feed across all branches',
}: {
  data?: DashboardRecentActivitiesResponse;
  isLoading?: boolean;
  scopeLabel?: string;
}) {
  if (isLoading || !data) {
    return (
      <div className="overflow-hidden rounded-xl border border-stroke-soft-200 bg-neutral-0">
        <div className="flex items-start justify-between gap-3 border-b border-stroke-soft-200 px-5 py-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-44" />
          </div>
          <Skeleton className="h-2 w-2 rounded-full" />
        </div>
        <div className="space-y-4 px-5 py-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stroke-soft-200 bg-neutral-0">
      <div className="flex items-start justify-between gap-3 border-b border-stroke-soft-200 px-4 py-4 sm:px-5">
        <div>
          <h3 className="text-base font-medium leading-6 text-text-main-900">Recent Activities</h3>
          <p className="text-sm font-normal leading-5 text-text-sub-500">{scopeLabel}</p>
        </div>
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#38C793]"
          aria-hidden
          title="Live"
        />
      </div>

      <div className="px-4 py-4 sm:px-5">
        {data.activities.length === 0 ? (
          <p className="py-6 text-sm text-text-sub-500">No recent activity yet.</p>
        ) : (
          <ul className="space-y-0">
            {data.activities.map((activity, index) => {
              const style = ACTIVITY_STYLES[activity.kind];
              const Icon = style.icon;
              const isLast = index === data.activities.length - 1;

              return (
                <li key={activity.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {!isLast && (
                    <span
                      className="absolute left-[17px] top-9 bottom-0 w-px bg-stroke-soft-200"
                      aria-hidden
                    />
                  )}
                  <div
                    className={cn(
                      'relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                      style.iconBg,
                    )}
                  >
                    <Icon className={cn('h-4 w-4', style.iconColor)} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 text-sm font-medium leading-5 text-text-main-900">
                        {activity.title}
                      </p>
                      <span className="shrink-0 text-xs leading-4 text-text-soft-400">
                        {formatRelativeTime(activity.occurredAt)}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm leading-5 text-text-sub-500 sm:line-clamp-1">
                      {activity.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
