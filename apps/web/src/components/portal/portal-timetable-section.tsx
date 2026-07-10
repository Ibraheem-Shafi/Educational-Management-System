'use client';

import { ContentPanel } from '@/components/layout/content-panel';
import { DAY_NAMES } from '@/lib/portal-types';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
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
}: {
  slots: TimetableSlot[];
  todaySlots?: TimetableSlot[];
}) {
  return (
    <div className="space-y-4">
      {todaySlots.length > 0 && (
        <ContentPanel title={`Today (${todaySlots.length} classes)`}>
          <ul className="divide-y divide-stroke-soft-200">
            {todaySlots.map((slot, i) => (
              <li key={i} className="px-5 py-3 text-sm">
                <p className="font-medium text-text-main-900">
                  {slot.startTime}–{slot.endTime} · {slot.subjectName ?? 'Class'}
                </p>
                <p className="mt-1 text-[var(--text-sub-500)]">
                  {slot.teacherName ? `${slot.teacherName} · ` : ''}
                  {slot.room ? `Room ${slot.room}` : 'Room TBA'}
                </p>
              </li>
            ))}
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
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                    No timetable published
                  </td>
                </tr>
              ) : (
                slots.map((slot, i) => (
                  <tr key={i}>
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
