'use client';

import type { AttendanceGridResponse } from '@eims/types';
import { UserAvatar } from '@/components/layout/user-avatar';
import { cn } from '@/lib/utils';

function dayParts(iso: string): { month: string; day: string; weekday: string } {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return {
    month: date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
    day: String(day).padStart(2, '0'),
    weekday: date.toLocaleString('en-US', { weekday: 'short', timeZone: 'UTC' }),
  };
}

function attendanceCellStyle(code: string): { letter: string; className: string } {
  switch (code) {
    case 'present':
      return { letter: 'P', className: 'bg-[#D9F5E8]' };
    case 'absent':
      return { letter: 'A', className: 'bg-[#FADADA]' };
    case 'leave':
    case 'excused':
      return { letter: 'L', className: 'bg-[#DCE4FA]' };
    case 'late':
      return { letter: 'L', className: 'bg-[#FFF0D4]' };
    default:
      return {
        letter: code.slice(0, 1).toUpperCase(),
        className: 'bg-[var(--neutral-50)]',
      };
  }
}

interface AttendanceGridProps {
  data: AttendanceGridResponse;
  selectedDate: string;
  isLoading?: boolean;
  entityLabel: string;
  onCellClick?: (rowId: string, date: string) => void;
}

export function AttendanceGrid({
  data,
  selectedDate,
  isLoading,
  entityLabel,
  onCellClick,
}: AttendanceGridProps) {
  if (isLoading) {
    return (
      <div className="bg-white">
        <div className="space-y-3 p-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--neutral-50)]" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.rows.length) {
    return (
      <div className="bg-white px-6 py-12 text-center text-sm text-[var(--text-sub-500)]">
        No {entityLabel.toLowerCase()} found for this selection.
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-20 min-w-[220px] border-b border-r border-[var(--stroke-soft-200)] bg-white px-4 py-3 text-left align-bottom">
                <div className="text-sm font-medium leading-5 text-[var(--text-main-900)]">Total</div>
                <div className="text-xs font-normal leading-4 text-[var(--text-sub-500)]">
                  {data.total} {entityLabel}
                </div>
              </th>
              {data.dates.map((date) => {
                const parts = dayParts(date);
                const selected = date === selectedDate;
                return (
                  <th
                    key={date}
                    className={cn(
                      'min-w-[52px] border-b border-r border-[var(--stroke-soft-200)] px-1 py-2 text-center align-bottom last:border-r-0',
                      selected ? 'bg-[var(--midnight-blue-950,#01366C)]' : 'bg-white',
                    )}
                  >
                    <div
                      className={cn(
                        'text-[10px] font-normal leading-3',
                        selected ? 'text-white/80' : 'text-[var(--text-sub-500)]',
                      )}
                    >
                      {parts.month}
                    </div>
                    <div
                      className={cn(
                        'text-sm font-medium leading-5',
                        selected ? 'text-white' : 'text-[var(--text-main-900)]',
                      )}
                    >
                      {parts.day}
                    </div>
                    <div
                      className={cn(
                        'text-[10px] font-normal leading-3',
                        selected ? 'text-white/80' : 'text-[var(--text-sub-500)]',
                      )}
                    >
                      {parts.weekday}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id} className="group">
                <td className="sticky left-0 z-10 border-b border-r border-[var(--stroke-soft-200)] bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      name={row.fullName}
                      gender={row.gender}
                      seed={row.id}
                      src={row.photographUrl}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium leading-5 text-[var(--text-main-900)]">
                        {row.fullName}
                      </div>
                      <div className="truncate text-xs font-normal leading-4 text-[var(--text-sub-500)]">
                        {row.subtitle}
                      </div>
                    </div>
                  </div>
                </td>
                {data.dates.map((date) => {
                  const status = row.attendance[date];
                  const selected = date === selectedDate;
                  const cell = status ? attendanceCellStyle(status.code) : null;
                  return (
                    <td
                      key={date}
                      className={cn(
                        'h-[52px] min-w-[52px] border-b border-r border-[var(--stroke-soft-200)] p-0 last:border-r-0',
                        !cell && selected && 'bg-[#F4F7FB]',
                        !cell && !selected && 'bg-white',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onCellClick?.(row.id, date)}
                        className={cn(
                          'flex h-full w-full items-center justify-center',
                          'text-sm font-semibold leading-5 text-[var(--text-main-900)]',
                          'transition-opacity hover:opacity-90',
                          cell?.className,
                        )}
                        aria-label={
                          status
                            ? `${row.fullName} ${date}: ${status.label}`
                            : `${row.fullName} ${date}: unmarked`
                        }
                      >
                        {cell?.letter ?? ''}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
