'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchId } from '@/hooks/use-branches';
import { useBatches } from '@/hooks/use-batches';
import { useLookups } from '@/hooks/use-lookups';
import { PageHeader } from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { TrendAreaChart } from '@/components/dashboard/trend-area-chart';
import { queryKeys } from '@/lib/query-keys';
import type { AttendanceStatsResponse, AttendanceTrendResponse } from '@eims/types';
import { AttendanceDateNav, monthFromIso } from '@/components/features/attendance/attendance-date-nav';
import { AttendanceSegmentedTabs } from '@/components/features/attendance/attendance-segmented-tabs';
import { AttendanceGrid } from '@/components/features/attendance/attendance-grid';
import type { AttendanceGridResponse } from '@eims/types';

type AttendanceMode = 'student' | 'teacher' | 'staff';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const MODE_TABS = [
  { id: 'student', label: 'Student' },
  { id: 'teacher', label: 'Teacher' },
  { id: 'staff', label: 'Staff' },
] as const;

export default function AttendancePage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [mode, setMode] = useState<AttendanceMode>('student');
  const [branchId, setBranchId] = useState(user?.branchId ?? '');
  const [batchId, setBatchId] = useState('');

  const viewMonth = monthFromIso(selectedDate);
  const { effectiveBranchId, branches } = useEffectiveBranchId(token, user?.branchId, branchId);
  const { data: batches } = useBatches(token, effectiveBranchId);
  const { data: statuses } = useLookups('attendance_status', token);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.attendanceStats,
    queryFn: () => apiClient<AttendanceStatsResponse>('/attendance/stats', { token }),
    enabled: !!token,
  });

  const { data: trend, isLoading: trendLoading } = useQuery({
    queryKey: queryKeys.attendanceTrend(viewMonth),
    queryFn: () =>
      apiClient<AttendanceTrendResponse>(`/attendance/trend?month=${viewMonth}`, { token }),
    enabled: !!token,
  });

  useEffect(() => {
    if (!batchId && batches?.data.length) {
      setBatchId(batches.data[0].id);
    }
  }, [batches, batchId]);

  const gridQueryKey = ['attendance-grid', viewMonth, mode, batchId, effectiveBranchId];

  const { data: grid, isLoading, isFetching } = useQuery({
    queryKey: gridQueryKey,
    queryFn: () => {
      const params = new URLSearchParams({
        month: viewMonth,
        entityType: mode,
      });
      if (effectiveBranchId) params.set('branchId', effectiveBranchId);
      if (mode === 'student' && batchId) params.set('batchId', batchId);
      return apiClient<AttendanceGridResponse>(`/attendance/grid?${params.toString()}`, { token });
    },
    enabled: !!token && !!effectiveBranchId && (mode !== 'student' || !!batchId),
  });

  const statusCycle = useMemo(() => {
    const list = statuses?.statuses ?? [];
    const preferred = ['present', 'absent', 'leave', 'late', 'excused'];
    const ordered = preferred
      .map((code) => list.find((s) => s.code === code))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    const rest = list.filter((s) => !preferred.includes(s.code));
    return [...ordered, ...rest];
  }, [statuses]);

  const entityLabel = mode === 'student' ? 'Students' : mode === 'teacher' ? 'Teachers' : 'Staff';

  const markMutation = useMutation({
    mutationFn: async ({
      rowId,
      date,
      statusId,
    }: {
      rowId: string;
      date: string;
      statusId: string;
    }) => {
      if (!effectiveBranchId) throw new Error('Branch is required');

      if (mode === 'student') {
        return apiClient('/attendance/bulk', {
          method: 'POST',
          token,
          body: JSON.stringify({
            branchId: effectiveBranchId,
            date,
            batchId,
            records: [{ studentId: rowId, statusId }],
          }),
        });
      }

      return apiClient('/attendance/staff-bulk', {
        method: 'POST',
        token,
        body: JSON.stringify({
          branchId: effectiveBranchId,
          date,
          entityType: mode,
          records: [{ userId: rowId, statusId }],
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gridQueryKey });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update attendance'),
  });

  const handleCellClick = useCallback(
    (rowId: string, date: string) => {
      if (!statusCycle.length) return;

      const row = grid?.rows.find((r) => r.id === rowId);
      const current = row?.attendance[date];
      const currentIndex = current
        ? statusCycle.findIndex((s) => s.id === current.statusId)
        : -1;
      const next = statusCycle[(currentIndex + 1) % statusCycle.length];
      if (!next) return;

      markMutation.mutate({ rowId, date, statusId: next.id });
    },
    [grid?.rows, markMutation, statusCycle],
  );

  const batchOptions = useMemo(
    () => (batches?.data ?? []).map((b) => ({ value: b.id, label: b.name })),
    [batches],
  );

  const branchOptions = useMemo(
    () => (branches?.data ?? []).map((b) => ({ value: b.id, label: b.name })),
    [branches],
  );

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={ClipboardCheck}
        title="Attendance"
        description="View and manage all attendance records"
      />

      <MainStatsSection
        isLoading={statsLoading}
        stats={[
          { label: "Today's rate", value: `${stats?.todayRate.total ?? 0}%`, changePercent: stats?.todayRate.changePercent },
          { label: 'Month average', value: `${stats?.monthAverage.total ?? 0}%`, changePercent: stats?.monthAverage.changePercent },
          { label: 'Present today', value: stats?.presentToday.total ?? 0, changePercent: stats?.presentToday.changePercent },
          { label: 'Absent today', value: stats?.absentToday.total ?? 0, changePercent: stats?.absentToday.changePercent },
        ]}
      />

      <TrendAreaChart
        title="Monthly attendance trend"
        subtitle={viewMonth}
        data={trend?.points ?? []}
        changePercent={trend?.changePercent}
        isLoading={trendLoading}
        valueFormatter={(v) => `${v}%`}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <AttendanceDateNav
            value={selectedDate}
            onChange={setSelectedDate}
            className="border border-[var(--stroke-soft-200,#E2E4E9)]"
          />

          {mode === 'student' && (
            <SelectDropdown
              value={batchId}
              onValueChange={setBatchId}
              options={batchOptions}
              placeholder="Select batch"
              aria-label="Batch"
              className="min-w-[180px]"
            />
          )}

          {!user?.branchId && (
            <SelectDropdown
              value={branchId}
              onValueChange={(value) => {
                setBranchId(value);
                setBatchId('');
              }}
              options={branchOptions}
              placeholder="Select branch"
              aria-label="Branch"
              className="min-w-[160px]"
            />
          )}
        </div>

        <AttendanceSegmentedTabs
          tabs={[...MODE_TABS]}
          activeId={mode}
          onChange={(id) => setMode(id as AttendanceMode)}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
        <AttendanceGrid
          data={
            grid ?? {
              month: viewMonth,
              branchId: effectiveBranchId ?? '',
              batchId: mode === 'student' ? batchId : null,
              batchName: null,
              entityType: mode,
              total: 0,
              dates: [],
              rows: [],
            }
          }
          selectedDate={selectedDate}
          isLoading={isLoading || isFetching}
          entityLabel={entityLabel}
          onCellClick={handleCellClick}
        />
      </div>
    </div>
  );
}
