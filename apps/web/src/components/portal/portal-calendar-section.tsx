'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PortalCalendarResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { buildPortalQuery } from '@/lib/portal-api';
import { ContentPanel } from '@/components/layout/content-panel';
import { StatusBadge } from '@/components/layout/status-badge';

const TYPE_LABELS: Record<string, string> = {
  notice: 'Notice',
  homework: 'Homework',
  assessment: 'Assessment',
  event: 'Event',
};

export function PortalCalendarSection({
  basePath,
  queryKey,
  month,
  onMonthChange,
  studentId,
}: {
  basePath: string;
  queryKey: (studentId: string, month: string) => readonly unknown[];
  month: string;
  onMonthChange: (month: string) => void;
  studentId?: string;
}) {
  const { session } = useAuth();
  const token = session?.access_token;

  const { data, isLoading } = useQuery({
    queryKey: studentId ? queryKey(studentId, month) : ['portal-calendar', month],
    queryFn: () =>
      apiClient<PortalCalendarResponse>(
        `${basePath}${buildPortalQuery({ month, studentId })}`,
        { token },
      ),
    enabled: !!token && (studentId ? !!studentId : true),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, PortalCalendarResponse['events']>();
    for (const event of data?.events ?? []) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data?.events]);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="space-y-4">
      <ContentPanel
        title={month}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-lg border border-stroke-soft-200 px-2 py-1 text-sm hover:bg-neutral-50"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded-lg border border-stroke-soft-200 px-2 py-1 text-sm hover:bg-neutral-50"
            >
              Next
            </button>
          </div>
        }
      >
        {isLoading && !data ? (
          <p className="px-5 py-6 text-sm text-[var(--text-sub-500)]">Loading calendar…</p>
        ) : grouped.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--text-sub-500)]">No events this month</p>
        ) : (
          <ul className="divide-y divide-stroke-soft-200">
            {grouped.map(([date, events]) => (
              <li key={date} className="px-5 py-4">
                <p className="text-sm font-medium text-text-main-900">
                  {new Date(date).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                <ul className="mt-2 space-y-2">
                  {events.map((event, i) => (
                    <li key={`${date}-${i}`} className="flex items-start gap-2 text-sm">
                      <StatusBadge label={TYPE_LABELS[event.type] ?? event.type} code={event.type} />
                      {event.href ? (
                        <Link href={event.href} className="text-text-main-900 hover:underline">
                          {event.title}
                        </Link>
                      ) : (
                        <span className="text-text-main-900">{event.title}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </ContentPanel>
    </div>
  );
}
