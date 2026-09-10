import type { DashboardTodayAttendanceResponse } from '@eims/types';
import { AttendanceDonut } from './attendance-donut';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const RING_COLORS = {
  students: 'var(--palette-teal)',
  teachersAndStaff: 'var(--palette-orange)',
  overall: 'var(--palette-purple)',
} as const;

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function AttendanceRing({
  label,
  ring,
  color,
}: {
  label: string;
  ring: DashboardTodayAttendanceResponse['students'];
  color: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-3 text-center">
      <AttendanceDonut rate={ring.rate} color={color} />
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium leading-5 text-[var(--text-sub-500)]">{label}</p>
        <p className="text-sm font-semibold leading-5 text-[var(--text-main-900)]">
          {formatCount(ring.presentCount)}
        </p>
      </div>
    </div>
  );
}

export function TodayAttendanceCard({
  data,
  isLoading,
  showStaffRings = true,
}: {
  data?: DashboardTodayAttendanceResponse;
  isLoading?: boolean;
  /** When false (no `users.manage`), only the students ring is shown. */
  showStaffRings?: boolean;
}) {
  const studentOnly = !showStaffRings || !data?.teachersAndStaff || !data?.overall;

  if (isLoading || !data) {
    return (
      <div className="rounded-xl border border-stroke-soft-200 bg-neutral-0 p-5">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-4 w-12" />
        </div>
        <div className={cn('grid gap-6', studentOnly ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3 sm:gap-4')}>
          {Array.from({ length: studentOnly ? 1 : 3 }).map((_, i) => (
            <div key={i} className="flex min-w-0 flex-col items-center gap-3">
              <Skeleton className="h-[104px] w-[104px] rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stroke-soft-200 bg-neutral-0 p-5">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium leading-6 text-[var(--text-main-900)]">
            Today&apos;s Attendance
          </h3>
          <p className="text-sm font-normal leading-5 text-[var(--text-sub-500)]">{data.scopeLabel}</p>
        </div>
        <span className="shrink-0 text-sm font-normal leading-5 text-[var(--text-soft-400)]">
          {data.dateLabel}
        </span>
      </div>

      <div
        className={cn(
          'grid gap-6',
          studentOnly ? 'grid-cols-1 place-items-center' : 'grid-cols-1 sm:grid-cols-3 sm:gap-4',
        )}
      >
        <AttendanceRing label="Students" ring={data.students} color={RING_COLORS.students} />
        {!studentOnly && data.teachersAndStaff && data.overall && (
          <>
            <AttendanceRing
              label="Teachers & Staff"
              ring={data.teachersAndStaff}
              color={RING_COLORS.teachersAndStaff}
            />
            <AttendanceRing label="Overall" ring={data.overall} color={RING_COLORS.overall} />
          </>
        )}
      </div>
    </div>
  );
}
