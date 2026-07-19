'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

function ordinal(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`;
  const last = day % 10;
  if (last === 1) return `${day}st`;
  if (last === 2) return `${day}nd`;
  if (last === 3) return `${day}rd`;
  return `${day}th`;
}

export function formatAttendanceNavDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const monthLabel = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${ordinal(day)} ${monthLabel} ${year}`;
}

export function shiftIsoDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function monthFromIso(iso: string): string {
  return iso.slice(0, 7);
}

export function AttendanceDateNav({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-10 items-center gap-2 rounded-[10px] bg-white px-2',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(shiftIsoDate(value, -1))}
        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-main-900)] hover:bg-[var(--neutral-50)]"
        aria-label="Previous day"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
      </button>
      <label
        className="relative flex min-w-[120px] cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-1 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900)] hover:bg-[var(--neutral-50)]"
        title="Pick a date"
      >
        <CalendarDays className="h-4 w-4 text-[var(--text-sub-500,#525866)]" strokeWidth={1.75} />
        <span>{formatAttendanceNavDate(value)}</span>
        <input
          type="date"
          value={value}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Jump to date"
        />
      </label>
      <button
        type="button"
        onClick={() => onChange(shiftIsoDate(value, 1))}
        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-main-900)] hover:bg-[var(--neutral-50)]"
        aria-label="Next day"
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
