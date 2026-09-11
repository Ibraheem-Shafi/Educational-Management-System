'use client';

import { ContentPanel } from '@/components/layout/content-panel';
import { Button } from '@/components/ui/button';
import { DAY_NAMES } from '@/lib/portal-types';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { seedRowClass } from '@/components/layout/status-badge';
import { EmptyStateCell } from '@/components/layout/empty-state';
import { accentForSeed, paletteColor, paletteSoft } from '@/lib/ui-palette';
import { cn } from '@/lib/utils';

interface TimetableSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  subjectName: string | null;
  teacherName?: string | null;
}

export function PortalTimetableSection({
  slots,
  todaySlots = [],
  isError = false,
  onRetry,
}: {
  slots: TimetableSlot[];
  todaySlots?: TimetableSlot[];
  isError?: boolean;
  onRetry?: () => void;
}) {
  if (isError) {
    return (
      <ContentPanel title="Timetable">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <p className="text-sm text-red-600">Unable to load timetable.</p>
          {onRetry ? (
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      </ContentPanel>
    );
  }

  return (
    <div className="space-y-4">
      {todaySlots.length > 0 && (
        <ContentPanel title={`Today (${todaySlots.length} classes)`}>
          <ul className="divide-y divide-stroke-soft-200">
            {todaySlots.map((slot, i) => {
              const accent = accentForSeed(slot.subjectName ?? `${slot.startTime}-${i}`);
              return (
                <li
                  key={i}
                  className="border-l-[3px] px-5 py-3 text-sm"
                  style={{
                    backgroundColor: paletteSoft(accent),
                    borderLeftColor: paletteColor(accent),
                  }}
                >
                  <p className="font-medium text-text-main-900">
                    {slot.startTime}–{slot.endTime} · {slot.subjectName ?? 'Class'}
                  </p>
                  <p className="mt-1 text-[var(--text-sub-500)]">
                    {slot.teacherName ? `${slot.teacherName} · ` : ''}
                    {slot.room ? `Room ${slot.room}` : 'Room TBA'}
                  </p>
                </li>
              );
            })}
          </ul>
        </ContentPanel>
      )}

      <ContentPanel title={`Weekly schedule (${slots.length})`}>
        <div className={dataTableWrapperClass}>
          <table className={cn(dataTableClass, 'min-w-[640px]')}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Day</th>
                <th className={dataTableThClass}>Time</th>
                <th className={dataTableThClass}>Subject</th>
                <th className={dataTableThClass}>Teacher</th>
                <th className={dataTableThClass}>Room</th>
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {slots.length === 0 ? (
                <EmptyStateCell colSpan={5} title="No timetable published" />
              ) : (
                slots.map((slot, i) => (
                  <tr key={i} className={seedRowClass(`${slot.dayOfWeek}-${slot.startTime}-${slot.subjectName ?? i}`, i)}>
                    <td className={dataTableTdClass}>
                      {DAY_NAMES[slot.dayOfWeek] ?? slot.dayOfWeek}
                    </td>
                    <td className={dataTableTdClass}>
                      {slot.startTime}–{slot.endTime}
                    </td>
                    <td className={dataTableTdClass}>{slot.subjectName ?? '—'}</td>
                    <td className={dataTableTdClass}>{slot.teacherName ?? '—'}</td>
                    <td className={dataTableTdClass}>{slot.room ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </ContentPanel>
    </div>
  );
}
