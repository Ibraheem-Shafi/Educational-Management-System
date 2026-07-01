'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { PageTabs } from '@/components/layout/page-tabs';
import { filterSelectClass } from '@/components/layout/filter-bar';
import { ListLoadingSkeleton } from '@/components/layout/list-loading-skeleton';

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

  const [view, setView] = useState<'batch' | 'teacher' | 'room'>('batch');
  const [filterBatchId, setFilterBatchId] = useState('');
  const [filterTeacherId, setFilterTeacherId] = useState('');
  const [filterRoom, setFilterRoom] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [room, setRoom] = useState('');

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiClient<{ data: { id: string; name: string }[] }>('/branches', { token }),
    enabled: !!token,
  });

  const effectiveBranchId = branchId || branches?.data[0]?.id || '';

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

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient('/timetable', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Slot added');
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      queryClient.invalidateQueries({ queryKey: ['timetable-conflicts'] });
      setShowForm(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/timetable/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Slot removed');
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
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
    <div className="space-y-6">
      <PageHeader
        title="Timetable"
        description="Weekly class schedules"
        actions={
          user?.permissions.includes('timetable.manage') ? (
            <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : 'Add slot'}</Button>
          ) : undefined
        }
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

      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          {view === 'batch' && (
            <select
              className={filterSelectClass}
              value={filterBatchId}
              onChange={(e) => setFilterBatchId(e.target.value)}
            >
              <option value="">All batches</option>
              {batches?.data.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          {view === 'teacher' && (
            <select
              className={filterSelectClass}
              value={filterTeacherId}
              onChange={(e) => setFilterTeacherId(e.target.value)}
            >
              <option value="">All teachers</option>
              {teachers?.data.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>
          )}
          {view === 'room' && (
            <Input
              placeholder="Room name"
              value={filterRoom}
              onChange={(e) => setFilterRoom(e.target.value)}
              className="max-w-xs"
            />
          )}
        </CardContent>
      </Card>

      {(conflicts?.conflicts.length ?? 0) > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader>
            <CardTitle className="text-amber-600">Schedule conflicts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {conflicts?.conflicts.map((c, i) => (
              <p key={i}>
                {c.type}: {c.message}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New timetable slot</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({
                  branchId: effectiveBranchId,
                  batchId,
                  subjectId,
                  dayOfWeek,
                  startTime,
                  endTime,
                  ...(teacherId ? { teacherId } : {}),
                  ...(room ? { room } : {}),
                });
              }}
            >
              <select
                className="flex h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                required
              >
                <option value="">Batch</option>
                {batches?.data.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <select
                className="flex h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                required
              >
                <option value="">Subject</option>
                {subjects?.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className="flex h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
              >
                <option value="">Teacher (optional)</option>
                {teachers?.data.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
              <select
                className="flex h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i + 1}>
                    {d}
                  </option>
                ))}
              </select>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              <Input placeholder="Room" value={room} onChange={(e) => setRoom(e.target.value)} />
              <Button type="submit" disabled={createMutation.isPending} className="sm:col-span-2 w-fit">
                Save slot
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading && <ListLoadingSkeleton />}

      <div className="grid gap-4 lg:grid-cols-2">
        {DAYS.map((dayLabel, idx) => {
          const daySlots = grouped.get(idx + 1) ?? [];
          return (
            <Card key={dayLabel}>
              <CardHeader>
                <CardTitle>{dayLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                {daySlots.length === 0 && (
                  <p className="text-sm text-muted-foreground">No classes</p>
                )}
                <div className="space-y-2">
                  {daySlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">
                          {slot.startTime}–{slot.endTime} · {slot.subject?.name ?? '—'}
                        </p>
                        <p className="text-muted-foreground">
                          {slot.batch?.name ?? '—'}
                          {slot.teacher ? ` · ${slot.teacher.fullName}` : ''}
                          {slot.room ? ` · ${slot.room}` : ''}
                        </p>
                      </div>
                      {user?.permissions.includes('timetable.manage') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm('Remove this slot?')) deleteMutation.mutate(slot.id);
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
