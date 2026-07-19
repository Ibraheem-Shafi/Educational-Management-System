'use client';

import { ContentPanel } from '@/components/layout/content-panel';
import { StatusBadge } from '@/components/layout/status-badge';
import { MetricDonutCard } from '@/components/dashboard/metric-donut-card';
import { PaginationBar } from '@/components/layout/pagination-bar';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { cn } from '@/lib/utils';
import type { PortalAttendanceSummary } from '@eims/types';

interface AttendanceRecord {
  date: string;
  status?: { label: string; code?: string } | null;
}

export function PortalAttendanceSection({
  records,
  summary,
  subtitle = 'Selected period',
  page,
  totalPages,
  onPageChange,
  limit,
  onLimitChange,
}: {
  records: AttendanceRecord[];
  summary?: PortalAttendanceSummary;
  subtitle?: string;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  limit?: number;
  onLimitChange?: (limit: number) => void;
}) {
  const rates = summary ?? { present: 0, absent: 0, late: 0, other: 0, presentRate: 0 };

  return (
    <div className="space-y-4">
      <MetricDonutCard
        title="Attendance mix"
        subtitle={subtitle}
        segments={[
          { label: 'Present', rate: rates.presentRate, color: '#38C793' },
          {
            label: 'Absent',
            rate: Math.round((rates.absent / Math.max(rates.present + rates.absent + rates.late + rates.other, 1)) * 100),
            color: '#EF4444',
          },
          {
            label: 'Late',
            rate: Math.round((rates.late / Math.max(rates.present + rates.absent + rates.late + rates.other, 1)) * 100),
            color: '#F59E0B',
          },
        ]}
      />

      <ContentPanel title={`Records (${records.length} on this page)`}>
        <div className={dataTableWrapperClass}>
          <table className={cn(dataTableClass, 'min-w-[480px]')}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Date</th>
                <th className={dataTableThClass}>Status</th>
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                    No attendance records
                  </td>
                </tr>
              ) : (
                records.map((row, i) => (
                  <tr key={`${row.date}-${i}`}>
                    <td className={dataTableTdClass}>{row.date}</td>
                    <td className={dataTableTdClass}>
                      <StatusBadge label={row.status?.label ?? '—'} code={row.status?.code} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {page && totalPages && onPageChange && (
          <div className="border-t border-stroke-soft-200 px-5 py-3">
            <PaginationBar
              page={page}
              totalPages={totalPages}
              onPageChange={onPageChange}
              limit={limit ?? 8}
              onLimitChange={onLimitChange ?? (() => {})}
            />
          </div>
        )}
      </ContentPanel>
    </div>
  );
}
