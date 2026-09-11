'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { withBranchScope } from '@/lib/branch-scope';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { useBatches } from '@/hooks/use-batches';
import { useLookups } from '@/hooks/use-lookups';
import { PageHeader } from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { TrendAreaChart } from '@/components/dashboard/trend-area-chart';
import { queryKeys } from '@/lib/query-keys';
import type { AttendanceStatsResponse, AttendanceTrendResponse } from '@eims/types';
import { AttendanceDateNav, monthFromIso } from '@/components/features/attendance/attendance-date-nav';
import { Tabs } from '@/components/ui/tabs';
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
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canMark = can(PERMISSIONS.ATTENDANCE_MARK);

  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [mode, setMode] = useState<AttendanceMode>('student');
  const [batchId, setBatchId] = useState('');
  const [notifyAbsences, setNotifyAbsences] = useState(true);

  const viewMonth = monthFromIso(selectedDate);
  const { effectiveScope, scopeKey, singleBranchId } = useEffectiveBranchScope();
  const effectiveBranchId = singleBranchId ?? '';
  const { data: batches } = useBatches(token, effectiveBranchId);
  const { data: statuses } = useLookups('attendance_status', token);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: [...queryKeys.attendanceStats, scopeKey],
    queryFn: () =>
      apiClient<AttendanceStatsResponse>(withBranchScope('/attendance/stats', effectiveScope), {
        token,
      }),
    enabled: !!token,
  });

  const { data: trend, isLoading: trendLoading } = useQuery({
    queryKey: [...queryKeys.attendanceTrend(viewMonth), scopeKey],
    queryFn: () =>
      apiClient<AttendanceTrendResponse>(
        withBranchScope('/attendance/trend', effectiveScope, { month: viewMonth }),
        { token },
      ),
    enabled: !!token,
  });

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
    }): Promise<{ absenceAlerts?: { sent: number; skipped: number } | null }> => {
      if (!effectiveBranchId) throw new Error('Branch is required');

      if (mode === 'student') {
        return apiClient<{ absenceAlerts?: { sent: number; skipped: number } | null }>(
          '/attendance/bulk',
          {
            method: 'POST',
            token,
            body: JSON.stringify({
              branchId: effectiveBranchId,
              date,
              batchId,
              records: [{ studentId: rowId, statusId }],
              notifyAbsences,
              notifyChannel: 'whatsapp',
            }),
          },
        );
      }

      await apiClient('/attendance/staff-bulk', {
        method: 'POST',
        token,
        body: JSON.stringify({
          branchId: effectiveBranchId,
          date,
          entityType: mode,
          records: [{ userId: rowId, statusId }],
        }),
      });
      return { absenceAlerts: null };
    },
    onSuccess: (res: { absenceAlerts?: { sent: number; skipped: number } | null }) => {
      queryClient.invalidateQueries({ queryKey: gridQueryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.attendanceStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardTodayAttendance });
      const queued = res.absenceAlerts?.sent ?? 0;
      if (queued > 0) {
        toast.success(`Queued ${queued} parent absence alert${queued === 1 ? '' : 's'}`);
      }
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update attendance'),
  });

  const handleCellClick = useCallback(
    (rowId: string, date: string) => {
      if (!canMark || !statusCycle.length) return;

      const row = grid?.rows.find((r) => r.id === rowId);
      const current = row?.attendance[date];
      const currentIndex = current
        ? statusCycle.findIndex((s) => s.id === current.statusId)
        : -1;
      const next = statusCycle[(currentIndex + 1) % statusCycle.length];
      if (!next) return;

      markMutation.mutate({ rowId, date, statusId: next.id });
    },
    [canMark, grid?.rows, markMutation, statusCycle],
  );

  const batchOptions = useMemo(
    () => (batches?.data ?? []).map((b) => ({ value: b.id, label: b.name })),
    [batches],
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

          {mode === 'student' && batchId ? (
            <>
              <button
                type="button"
                className="rounded-lg border border-[var(--stroke-soft-200,#E2E4E9)] px-3 py-2 text-sm"
                onClick={() => {
                  const qs = new URLSearchParams({
                    batchId,
                    date: selectedDate,
                    ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
                  });
                  window.open(`/print/attendance-sheets?${qs.toString()}`, '_blank');
                }}
              >
                Print sheet
              </button>
              <button
                type="button"
                className="rounded-lg border border-[var(--stroke-soft-200,#E2E4E9)] px-3 py-2 text-sm"
                onClick={() => window.open(`/print/rosters?batchId=${batchId}`, '_blank')}
              >
                Print roster
              </button>
              <button
                type="button"
                className="rounded-lg border border-[var(--stroke-soft-200,#E2E4E9)] px-3 py-2 text-sm"
                onClick={() => {
                  apiClient<{ updated?: number }>('/students/generate-roll-numbers', {
                    method: 'POST',
                    token,
                    body: JSON.stringify({ batchId, startFrom: 1, padLength: 3 }),
                  })
                    .then((res) => {
                      toast.success(`Generated roll numbers for ${res.updated ?? 0} students`);
                      void queryClient.invalidateQueries({ queryKey: gridQueryKey });
                    })
                    .catch((err: Error) => toast.error(err.message));
                }}
              >
                Generate roll #s
              </button>
            </>
          ) : null}

          <PageBranchScopeControl />

          {mode === 'student' && canMark ? (
            <label className="flex items-center gap-2 text-sm text-[var(--text-main-900)]">
              <input
                type="checkbox"
                checked={notifyAbsences}
                onChange={(e) => setNotifyAbsences(e.target.checked)}
                className="h-4 w-4 accent-[var(--midnight-blue-950,#01366C)]"
              />
              Notify parents when marked absent
            </label>
          ) : null}
        </div>

        <Tabs
          aria-label="Attendance type"
          tabs={[...MODE_TABS]}
          value={mode}
          onValueChange={(id) => setMode(id as AttendanceMode)}
        />
      </div>

      {!effectiveBranchId && (
        <p className="text-sm text-[var(--text-sub-500)]">
          Select a single branch (app or page scope) to view and mark the attendance grid.
        </p>
      )}

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
