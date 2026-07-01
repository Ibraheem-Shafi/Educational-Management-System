'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchId } from '@/hooks/use-branches';
import { useBatches } from '@/hooks/use-batches';
import { useLookups } from '@/hooks/use-lookups';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/page-header';
import { PageTabs } from '@/components/layout/page-tabs';
import { FilterBar, filterSelectClass } from '@/components/layout/filter-bar';
import { ListLoadingSkeleton } from '@/components/layout/list-loading-skeleton';
import { ListRow } from '@/components/layout/list-row';
import { VirtualList } from '@/components/layout/virtual-list';
import { AttendanceStudentRow } from '@/components/features/attendance-student-row';

interface SheetStudent {
  studentId: string;
  fullName: string;
  attendance: { statusId: string } | null;
}

interface AttendanceSheet {
  students: SheetStudent[];
  summary: { total: number; marked: number; unmarked: number };
  batchName: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [date, setDate] = useState(todayIso());
  const [mode, setMode] = useState<'student' | 'teacher' | 'staff'>('student');
  const [branchId, setBranchId] = useState(user?.branchId ?? '');
  const [batchId, setBatchId] = useState('');
  const [statusByStudent, setStatusByStudent] = useState<Record<string, string>>({});
  const [statusByUser, setStatusByUser] = useState<Record<string, string>>({});

  const { effectiveBranchId, branches } = useEffectiveBranchId(token, user?.branchId, branchId);

  const { data: batches } = useBatches(token, effectiveBranchId);

  const { data: statuses } = useLookups('attendance_status', token);

  const sheetQueryKey = ['attendance-sheet', date, batchId, effectiveBranchId];

  const {
    data: sheet,
    isLoading: sheetLoading,
    isFetching: sheetFetching,
  } = useQuery({
    queryKey: sheetQueryKey,
    queryFn: () =>
      apiClient<AttendanceSheet>(
        `/attendance/sheet?date=${date}&batchId=${batchId}&branchId=${effectiveBranchId}`,
        { token },
      ),
    enabled: !!token && !!batchId && !!effectiveBranchId && mode === 'student',
  });

  const { data: staffSheet, isLoading: staffSheetLoading } = useQuery({
    queryKey: ['staff-attendance', date, effectiveBranchId, mode],
    queryFn: () =>
      apiClient<{
        members: { userId: string; fullName: string; attendance: { statusId: string } | null }[];
      }>(
        `/attendance/staff-sheet?date=${date}&branchId=${effectiveBranchId}&entityType=${mode}`,
        { token },
      ),
    enabled: !!token && !!effectiveBranchId && mode !== 'student',
  });

  useEffect(() => {
    if (!staffSheet) return;
    const initial: Record<string, string> = {};
    for (const row of staffSheet.members) {
      if (row.attendance?.statusId) initial[row.userId] = row.attendance.statusId;
    }
    setStatusByUser(initial);
  }, [staffSheet]);

  useEffect(() => {
    if (!sheet) return;
    const initial: Record<string, string> = {};
    for (const row of sheet.students) {
      if (row.attendance?.statusId) {
        initial[row.studentId] = row.attendance.statusId;
      }
    }
    setStatusByStudent(initial);
  }, [sheet]);

  const presentStatusId = useMemo(
    () => statuses?.statuses.find((s) => s.code === 'present')?.id,
    [statuses],
  );

  const markAllPresent = () => {
    if (!presentStatusId || !sheet) return;
    const next: Record<string, string> = {};
    for (const row of sheet.students) {
      next[row.studentId] = presentStatusId;
    }
    setStatusByStudent(next);
  };

  const handleStatusChange = useCallback((studentId: string, statusId: string) => {
    setStatusByStudent((prev) => ({ ...prev, [studentId]: statusId }));
  }, []);

  const attendanceStatuses = statuses?.statuses ?? [];

  const saveMutation = useMutation({
    mutationFn: () => {
      const records = Object.entries(statusByStudent)
        .filter(([, statusId]) => statusId)
        .map(([studentId, statusId]) => ({ studentId, statusId }));

      if (records.length === 0) {
        throw new Error('Select at least one student status');
      }

      return apiClient<{ marked: number }>('/attendance/bulk', {
        method: 'POST',
        token,
        body: JSON.stringify({
          branchId: effectiveBranchId,
          date,
          batchId,
          records,
        }),
      });
    },
    onSuccess: (data) => {
      toast.success(`Attendance saved for ${data.marked} students`);
      queryClient.invalidateQueries({ queryKey: sheetQueryKey });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save attendance'),
  });

  const saveStaffMutation = useMutation({
    mutationFn: () => {
      const records = Object.entries(statusByUser)
        .filter(([, statusId]) => statusId)
        .map(([userId, statusId]) => ({ userId, statusId }));
      if (records.length === 0) throw new Error('Select at least one status');
      return apiClient('/attendance/staff-bulk', {
        method: 'POST',
        token,
        body: JSON.stringify({
          branchId: effectiveBranchId,
          date,
          entityType: mode,
          records,
        }),
      });
    },
    onSuccess: () => {
      toast.success('Staff attendance saved');
      queryClient.invalidateQueries({ queryKey: ['staff-attendance'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const dirtyCount = sheet
    ? sheet.students.filter((row) => statusByStudent[row.studentId]).length
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description="Mark daily attendance" />

      <PageTabs
        tabs={[
          { id: 'student', label: 'Students' },
          { id: 'teacher', label: 'Teachers' },
          { id: 'staff', label: 'Staff' },
        ]}
        activeId={mode}
        onChange={(id) => setMode(id as 'student' | 'teacher' | 'staff')}
      />

      {mode === 'student' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Select batch & date</CardTitle>
            </CardHeader>
            <CardContent>
              <FilterBar>
                <div className="w-full space-y-2 sm:w-auto">
                  <label className="text-sm font-medium">Date</label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full sm:w-auto" />
                </div>

                {!user?.branchId && (
                  <div className="w-full space-y-2 sm:w-auto">
                    <label className="text-sm font-medium">Branch</label>
                    <select
                      className={filterSelectClass}
                      value={branchId}
                      onChange={(e) => {
                        setBranchId(e.target.value);
                        setBatchId('');
                      }}
                    >
                      <option value="">Select branch</option>
                      {branches?.data.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="w-full space-y-2 sm:w-auto">
                  <label htmlFor="attendance-batch" className="text-sm font-medium">
                    Batch
                  </label>
                  <select
                    id="attendance-batch"
                    className={filterSelectClass}
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    disabled={!effectiveBranchId}
                  >
                    <option value="">Select batch</option>
                    {batches?.data.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </FilterBar>
            </CardContent>
          </Card>

          {batchId && (
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>
                    {sheet?.batchName ?? 'Batch'} — {date}
                  </CardTitle>
                  {sheet && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {sheet.summary.marked} marked · {sheet.summary.unmarked} unmarked ·{' '}
                      {sheet.summary.total} total
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={markAllPresent}
                    disabled={!presentStatusId || !sheet?.students.length}
                  >
                    Mark all present
                  </Button>
                  <Button
                    type="button"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || dirtyCount === 0}
                  >
                    {saveMutation.isPending ? 'Saving...' : 'Save attendance'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(sheetLoading || sheetFetching) && <ListLoadingSkeleton />}
                {!sheetLoading && sheet?.students.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">No students in this batch</p>
                )}
                {sheet && sheet.students.length > 0 && (
                  <VirtualList
                    items={sheet.students}
                    estimateSize={64}
                    maxHeight={520}
                    getKey={(row) => row.studentId}
                    renderItem={(row) => (
                      <AttendanceStudentRow
                        studentId={row.studentId}
                        fullName={row.fullName}
                        value={statusByStudent[row.studentId] ?? ''}
                        statuses={attendanceStatuses}
                        onChange={handleStatusChange}
                      />
                    )}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {mode !== 'student' && (
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>
              {mode === 'teacher' ? 'Teachers' : 'Staff'} — {date}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full sm:w-auto" />
              <Button onClick={() => saveStaffMutation.mutate()} disabled={saveStaffMutation.isPending}>
                Save
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {staffSheetLoading && <ListLoadingSkeleton />}
            <div className="divide-y divide-border">
              {staffSheet?.members.map((row) => (
                <ListRow
                  key={row.userId}
                  actions={
                    <select
                      className={filterSelectClass}
                      value={statusByUser[row.userId] ?? ''}
                      onChange={(e) =>
                        setStatusByUser((prev) => ({ ...prev, [row.userId]: e.target.value }))
                      }
                    >
                      <option value="">—</option>
                      {statuses?.statuses.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  }
                >
                  <p className="font-medium">{row.fullName}</p>
                </ListRow>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
