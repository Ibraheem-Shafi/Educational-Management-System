'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { PageTabs } from '@/components/layout/page-tabs';
import { ContentPanel } from '@/components/layout/content-panel';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import type { TimetableStatsResponse } from '@eims/types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Slot {
  id: string;
  batchId: string;
  subjectId: string;
  teacherId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  batch?: { name: string } | null;
  subject?: { name: string } | null;
  teacher?: { fullName: string } | null;
}

export default function TimetablePage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const branchId = user?.branchId ?? '';
  const canManage = user?.permissions.includes('timetable.manage');

  const [view, setView] = useState<'batch' | 'teacher' | 'room'>('batch');
  const [filterBatchId, setFilterBatchId] = useState('');
  const [filterTeacherId, setFilterTeacherId] = useState('');
  const [filterRoom, setFilterRoom] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [room, setRoom] = useState('');

  const { data: branches } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: () => apiClient<{ data: { id: string; name: string }[] }>('/branches', { token }),
    enabled: !!token,
  });

  const effectiveBranchId = branchId || branches?.data[0]?.id || '';

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.timetableStats,
    queryFn: () => apiClient<TimetableStatsResponse>('/timetable/stats', { token }),
    enabled: !!token,
  });

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (effectiveBranchId) p.set('branchId', effectiveBranchId);
    if (view === 'batch' && filterBatchId) p.set('batchId', filterBatchId);
    if (view === 'teacher' && filterTeacherId) p.set('teacherId', filterTeacherId);
    if (view === 'room' && filterRoom) p.set('room', filterRoom);
    return p.toString();
  }, [effectiveBranchId, view, filterBatchId, filterTeacherId, filterRoom]);

  const { data: slots, isLoading } = useQuery({
    queryKey: ['timetable', queryParams],
    queryFn: () => apiClient<{ data: Slot[] }>(`/timetable?${queryParams}`, { token }),
    enabled: !!token && !!effectiveBranchId,
  });

  const { data: conflicts } = useQuery({
    queryKey: ['timetable-conflicts', queryParams],
    queryFn: () =>
      apiClient<{ conflicts: Array<{ slotId: string; type: string; message: string }> }>(
        `/timetable/conflicts?${queryParams}`,
        { token },
      ),
    enabled: !!token && !!effectiveBranchId,
  });

  const { data: batches } = useQuery({
    queryKey: ['batches', effectiveBranchId],
    queryFn: () =>
      apiClient<{ data: { id: string; name: string }[] }>(
        `/batches?branchId=${effectiveBranchId}`,
        { token },
      ),
    enabled: !!token && !!effectiveBranchId,
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => apiClient<{ data: { id: string; name: string }[] }>('/subjects', { token }),
    enabled: !!token,
  });

  const { data: teachers } = useQuery({
    queryKey: ['users-teachers'],
    queryFn: () =>
      apiClient<{ data: { id: string; fullName: string }[] }>('/users?limit=100', { token }),
    enabled: !!token,
  });

  const batchFilterOptions = [
    { value: '', label: 'All batches' },
    ...(batches?.data.map((b) => ({ value: b.id, label: b.name })) ?? []),
  ];

  const teacherFilterOptions = [
    { value: '', label: 'All teachers' },
    ...(teachers?.data.map((t) => ({ value: t.id, label: t.fullName })) ?? []),
  ];

  const dayOptions = DAYS.map((d, i) => ({ value: String(i + 1), label: d }));

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient('/timetable', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Slot added');
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      queryClient.invalidateQueries({ queryKey: ['timetable-conflicts'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.timetableStats });
      setShowForm(false);
      setBatchId('');
      setSubjectId('');
      setTeacherId('');
      setRoom('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/timetable/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Slot removed');
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.timetableStats });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const grouped = useMemo(() => {
    const map = new Map<number, Slot[]>();
    for (const slot of slots?.data ?? []) {
      const list = map.get(slot.dayOfWeek) ?? [];
      list.push(slot);
      map.set(slot.dayOfWeek, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [slots?.data]);

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={CalendarDays}
        title="Timetable"
        description="Weekly class schedules"
        actions={
          canManage ? (
            <button type="button" onClick={() => setShowForm(true)} className={pageHeaderActionClassName}>
              <PageHeaderActionIcon />
              Add slot
            </button>
          ) : undefined
        }
      />

      <MainStatsSection
        isLoading={statsLoading}
        stats={[
          {
            label: 'Slots per week',
            value: stats?.slotsPerWeek.total ?? 0,
            changePercent: stats?.slotsPerWeek.changePercent,
          },
          {
            label: 'Rooms used',
            value: stats?.roomsUsed.total ?? 0,
            changePercent: stats?.roomsUsed.changePercent,
          },
          {
            label: 'Teachers scheduled',
            value: stats?.teachersScheduled.total ?? 0,
            changePercent: stats?.teachersScheduled.changePercent,
          },
          {
            label: 'Batches scheduled',
            value: stats?.batchesScheduled.total ?? 0,
            changePercent: stats?.batchesScheduled.changePercent,
          },
        ]}
      />

      <PageTabs
        tabs={[
          { id: 'batch', label: 'By batch' },
          { id: 'teacher', label: 'By teacher' },
          { id: 'room', label: 'By room' },
        ]}
        activeId={view}
        onChange={(id) => setView(id as typeof view)}
      />

      <div className="flex flex-wrap items-center gap-3">
        {view === 'batch' && (
          <SelectDropdown
            aria-label="Filter by batch"
            placeholder="All batches"
            value={filterBatchId}
            onValueChange={setFilterBatchId}
            options={batchFilterOptions}
          />
        )}
        {view === 'teacher' && (
          <SelectDropdown
            aria-label="Filter by teacher"
            placeholder="All teachers"
            value={filterTeacherId}
            onValueChange={setFilterTeacherId}
            options={teacherFilterOptions}
          />
        )}
        {view === 'room' && (
          <Input
            placeholder="Room name"
            value={filterRoom}
            onChange={(e) => setFilterRoom(e.target.value)}
            className="max-w-xs"
          />
        )}
      </div>

      {(conflicts?.conflicts.length ?? 0) > 0 && (
        <ContentPanel title="Schedule conflicts" className="border-amber-500/50">
          <div className="space-y-1 px-5 py-4 text-sm text-amber-700">
            {conflicts?.conflicts.map((c, i) => (
              <p key={i}>
                {c.type}: {c.message}
              </p>
            ))}
          </div>
        </ContentPanel>
      )}

      {isLoading && (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-[var(--neutral-50)]" />
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {!isLoading &&
          DAYS.map((dayLabel, idx) => {
            const daySlots = grouped.get(idx + 1) ?? [];
            return (
              <ContentPanel key={dayLabel} title={dayLabel}>
                <div className="space-y-2 px-5 py-4">
                  {daySlots.length === 0 && (
                    <p className="text-sm text-[var(--text-sub-500)]">No classes</p>
                  )}
                  {daySlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-[var(--stroke-soft-200,#E2E4E9)] p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-[var(--text-main-900)]">
                          {slot.startTime}–{slot.endTime} · {slot.subject?.name ?? '—'}
                        </p>
                        <p className="text-[var(--text-sub-500)]">
                          {slot.batch?.name ?? '—'}
                          {slot.teacher ? ` · ${slot.teacher.fullName}` : ''}
                          {slot.room ? ` · ${slot.room}` : ''}
                        </p>
                      </div>
                      {canManage && (
                        <RowActionsMenu
                          items={[
                            {
                              label: 'Remove',
                              onClick: () => {
                                if (confirm('Remove this slot?')) deleteMutation.mutate(slot.id);
                              },
                            },
                          ]}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </ContentPanel>
            );
          })}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <div>
              <DialogTitle>New timetable slot</DialogTitle>
              <DialogDescription>Add a class to the weekly schedule.</DialogDescription>
            </div>
            <button type="button" onClick={() => setShowForm(false)} className="text-[var(--text-sub-500)]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form
            className="grid gap-4 px-5 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({
                branchId: effectiveBranchId,
                batchId,
                subjectId,
                dayOfWeek: Number(dayOfWeek),
                startTime,
                endTime,
                ...(teacherId ? { teacherId } : {}),
                ...(room ? { room } : {}),
              });
            }}
          >
            <SelectDropdown
              aria-label="Batch"
              placeholder="Select batch"
              value={batchId}
              onValueChange={setBatchId}
              options={[{ value: '', label: 'Select batch' }, ...(batches?.data.map((b) => ({ value: b.id, label: b.name })) ?? [])]}
              fullWidth
            />
            <SelectDropdown
              aria-label="Subject"
              placeholder="Select subject"
              value={subjectId}
              onValueChange={setSubjectId}
              options={[{ value: '', label: 'Select subject' }, ...(subjects?.data.map((s) => ({ value: s.id, label: s.name })) ?? [])]}
              fullWidth
            />
            <SelectDropdown
              aria-label="Teacher"
              placeholder="Teacher (optional)"
              value={teacherId}
              onValueChange={setTeacherId}
              options={[{ value: '', label: 'Teacher (optional)' }, ...(teachers?.data.map((t) => ({ value: t.id, label: t.fullName })) ?? [])]}
              fullWidth
            />
            <SelectDropdown
              aria-label="Day of week"
              placeholder="Day"
              value={dayOfWeek}
              onValueChange={setDayOfWeek}
              options={dayOptions}
              fullWidth
            />
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            <Input placeholder="Room" value={room} onChange={(e) => setRoom(e.target.value)} className="sm:col-span-2" />
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !batchId || !subjectId}>
                Save slot
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
