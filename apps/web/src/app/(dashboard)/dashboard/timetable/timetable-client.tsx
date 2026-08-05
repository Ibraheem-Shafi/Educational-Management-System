'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, GripVertical, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS, createTimetableSlotSchema } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { withBranchScope } from '@/lib/branch-scope';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { useUsersOptions } from '@/hooks/use-users-options';
import { useSubjectsOptions } from '@/hooks/use-subjects-options';
import { FormFieldError } from '@/components/forms/form-field-error';
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { ContentPanel } from '@/components/layout/content-panel';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { SearchInput } from '@/components/layout/search-input';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { cn } from '@/lib/utils';
import type { TimetableStatsResponse } from '@eims/types';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_RANGE_DAYS = 31;

function mondayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDayDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function dayOfWeekFromIso(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay();
  return dow === 0 ? 7 : dow;
}

function dayLabelFromIso(iso: string): string {
  return DAY_LABELS[dayOfWeekFromIso(iso) - 1] ?? '';
}

function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  let cur = start;
  while (cur <= end) {
    days.push(cur);
    cur = shiftIso(cur, 1);
    if (days.length > MAX_RANGE_DAYS) break;
  }
  return days;
}

function currentWeekRange(): { start: string; end: string } {
  const start = mondayOf(todayIso());
  return { start, end: shiftIso(start, 6) };
}

function isPastDate(iso: string): boolean {
  return iso < todayIso();
}

function clampRangeEnd(start: string, end: string): string {
  if (end < start) return start;
  const maxEnd = shiftIso(start, MAX_RANGE_DAYS - 1);
  return end > maxEnd ? maxEnd : end;
}

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
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.TIMETABLE_MANAGE);

  const [rangeStart, setRangeStart] = useState(() => currentWeekRange().start);
  const [rangeEnd, setRangeEnd] = useState(() => currentWeekRange().end);
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  const [draftRangeStart, setDraftRangeStart] = useState(() => currentWeekRange().start);
  const [draftRangeEnd, setDraftRangeEnd] = useState(() => currentWeekRange().end);
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const [draggingSourceDate, setDraggingSourceDate] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [pendingSlotIds, setPendingSlotIds] = useState<Set<string>>(new Set());
  const [filterBatchId, setFilterBatchId] = useState('');
  const [filterTeacherId, setFilterTeacherId] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterRoom, setFilterRoom] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deleteSlotId, setDeleteSlotId] = useState<string | null>(null);

  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [room, setRoom] = useState('');
  const {
    errors: slotErrors,
    validate: validateSlot,
    clearField: clearSlotField,
    fieldClassName: slotFieldClassName,
    applyApiErrors: applySlotApiErrors,
    setFieldError: setSlotFieldError,
    clearAll: clearSlotErrors,
  } = useFormErrors(createTimetableSlotSchema);

  const visibleDates = useMemo(
    () => daysBetween(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  );

  const disabledDayOfWeek = useMemo(() => {
    const disabled = new Set<number>();
    for (let dow = 1; dow <= 7; dow += 1) {
      const matching = visibleDates.filter((d) => dayOfWeekFromIso(d) === dow);
      if (matching.length > 0 && matching.every((d) => isPastDate(d))) {
        disabled.add(dow);
      }
    }
    return disabled;
  }, [visibleDates]);

  const { effectiveScope, scopeKey, singleBranchId } = useEffectiveBranchScope();
  const effectiveBranchId = singleBranchId ?? '';

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: [...queryKeys.timetableStats, scopeKey],
    queryFn: () =>
      apiClient<TimetableStatsResponse>(withBranchScope('/timetable/stats', effectiveScope), {
        token,
      }),
    enabled: !!token,
  });

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (effectiveBranchId) p.set('branchId', effectiveBranchId);
    if (filterBatchId) p.set('batchId', filterBatchId);
    if (filterTeacherId) p.set('teacherId', filterTeacherId);
    if (filterSubjectId) p.set('subjectId', filterSubjectId);
    if (filterRoom.trim()) p.set('room', filterRoom.trim());
    return p.toString();
  }, [effectiveBranchId, filterBatchId, filterTeacherId, filterSubjectId, filterRoom]);

  const timetableQueryKey = useMemo(() => ['timetable', queryParams] as const, [queryParams]);

  const { data: slots, isLoading } = useQuery({
    queryKey: timetableQueryKey,
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
        `/batches/options?branchId=${effectiveBranchId}`,
        { token },
      ),
    enabled: !!token && !!effectiveBranchId,
  });

  const { data: subjects } = useSubjectsOptions(token);

  const { data: teachers } = useUsersOptions(token, effectiveBranchId ?? '', {
    enabled: !!effectiveBranchId,
    role: 'teacher',
  });

  const batchFilterOptions = [
    { value: '', label: 'All batches' },
    ...(batches?.data.map((b) => ({ value: b.id, label: b.name })) ?? []),
  ];

  const teacherFilterOptions = [
    { value: '', label: 'All teachers' },
    ...(teachers?.data.map((t) => ({ value: t.id, label: t.fullName })) ?? []),
  ];

  const subjectFilterOptions = [
    { value: '', label: 'All subjects' },
    ...(subjects?.data.map((s) => ({ value: s.id, label: s.name })) ?? []),
  ];

  const dayOptions = DAY_LABELS.map((d, i) => {
    const dow = i + 1;
    return {
      value: String(dow),
      label: disabledDayOfWeek.has(dow) ? `${d} (past)` : d,
    };
  });

  const goToCurrentWeek = () => {
    const { start, end } = currentWeekRange();
    setRangeStart(start);
    setRangeEnd(end);
  };

  const openRangePicker = () => {
    setDraftRangeStart(rangeStart);
    setDraftRangeEnd(rangeEnd);
    setRangePickerOpen(true);
  };

  const applyRangePicker = () => {
    if (!draftRangeStart) return;
    const end = clampRangeEnd(draftRangeStart, draftRangeEnd || draftRangeStart);
    setRangeStart(draftRangeStart);
    setRangeEnd(end);
    setRangePickerOpen(false);
  };

  const shiftRangeByWeek = (direction: -1 | 1) => {
    const delta = direction * 7;
    setRangeStart((s) => shiftIso(s, delta));
    setRangeEnd((e) => shiftIso(e, delta));
  };

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
    onError: (err: Error) => {
      if (handleFormValidationError(err, applySlotApiErrors)) return;
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/timetable/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Slot removed');
      setDeleteSlotId(null);
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.timetableStats });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiClient(`/timetable/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey: timetableQueryKey });
      const previous = queryClient.getQueryData<{ data: Slot[] }>(timetableQueryKey);
      if (previous && typeof body.dayOfWeek === 'number') {
        queryClient.setQueryData(timetableQueryKey, {
          ...previous,
          data: previous.data.map((s) =>
            s.id === id ? { ...s, dayOfWeek: body.dayOfWeek as number } : s,
          ),
        });
      }
      setPendingSlotIds((prev) => new Set(prev).add(id));
      setDraggingSlotId(null);
      setDraggingSourceDate(null);
      setDragOverDate(null);
      return { previous };
    },
    onSuccess: () => {
      toast.success('Slot moved');
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(timetableQueryKey, context.previous);
      }
      toast.error(err.message || 'Failed to move slot');
    },
    onSettled: (_data, _err, { id }) => {
      setPendingSlotIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      queryClient.invalidateQueries({ queryKey: ['timetable-conflicts'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.timetableStats });
    },
  });

  const moveSlotToDay = (
    slotId: string,
    targetDayOfWeek: number,
    targetDateIso: string,
    sourceDateIso: string,
  ) => {
    setDraggingSlotId(null);
    setDraggingSourceDate(null);
    setDragOverDate(null);

    if (isPastDate(targetDateIso) || isPastDate(sourceDateIso)) {
      toast.error('Cannot move schedule to or from past dates');
      return;
    }

    const slot = (slots?.data ?? []).find((s) => s.id === slotId);
    if (!slot || slot.dayOfWeek === targetDayOfWeek) return;

    updateMutation.mutate({ id: slotId, body: { dayOfWeek: targetDayOfWeek } });
  };

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

  const isCurrentWeek =
    rangeStart === currentWeekRange().start && rangeEnd === currentWeekRange().end;

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={CalendarDays}
        title="Timetable"
        description="Weekly class schedules — drag slots to reschedule"
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

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          placeholder="Search by room"
          value={filterRoom}
          onValueChange={setFilterRoom}
          trimValue={false}
          className="max-w-[180px]"
        />
        <SelectDropdown
          aria-label="Filter by batch"
          placeholder="All batches"
          value={filterBatchId}
          onValueChange={setFilterBatchId}
          options={batchFilterOptions}
          className="min-w-[180px]"
        />
        <SelectDropdown
          aria-label="Filter by teacher"
          placeholder="All teachers"
          value={filterTeacherId}
          onValueChange={setFilterTeacherId}
          options={teacherFilterOptions}
          className="min-w-[180px]"
        />
        <SelectDropdown
          aria-label="Filter by subject"
          placeholder="All subjects"
          value={filterSubjectId}
          onValueChange={setFilterSubjectId}
          options={subjectFilterOptions}
          className="min-w-[180px]"
        />
        <PageBranchScopeControl />
      </div>

      {!effectiveBranchId && (
        <p className="text-sm text-[var(--text-sub-500)]">
          Select a single branch (app or page scope) to view and manage the timetable.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white px-3 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftRangeByWeek(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-main-900)] hover:bg-[var(--neutral-50)]"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={openRangePicker}
              className="flex min-w-[200px] items-center justify-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-[var(--text-main-900)] hover:bg-[var(--neutral-50)]"
              aria-label="Select date range"
              aria-expanded={rangePickerOpen}
            >
              <CalendarDays
                className="h-4 w-4 text-[var(--text-sub-500,#525866)]"
                strokeWidth={1.75}
              />
              <span>
                {formatDayDate(rangeStart)} – {formatDayDate(rangeEnd)}
              </span>
            </button>

            {rangePickerOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default"
                  aria-label="Close date range picker"
                  onClick={() => setRangePickerOpen(false)}
                />
                <div className="absolute left-1/2 top-full z-50 mt-2 w-[280px] -translate-x-1/2 rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-4 shadow-lg">
                  <p className="mb-3 text-sm font-medium text-[var(--text-main-900)]">
                    Select date range
                  </p>
                  <div className="grid gap-3">
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="timetable-range-start"
                        className="text-xs font-medium text-[var(--text-sub-500)]"
                      >
                        From
                      </label>
                      <Input
                        id="timetable-range-start"
                        type="date"
                        value={draftRangeStart}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (!next) return;
                          setDraftRangeStart(next);
                          setDraftRangeEnd((end) => clampRangeEnd(next, end));
                        }}
                        className="h-9"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor="timetable-range-end"
                        className="text-xs font-medium text-[var(--text-sub-500)]"
                      >
                        To
                      </label>
                      <Input
                        id="timetable-range-end"
                        type="date"
                        value={draftRangeEnd}
                        min={draftRangeStart}
                        max={shiftIso(draftRangeStart, MAX_RANGE_DAYS - 1)}
                        onChange={(e) => {
                          const next = e.target.value;
                          if (!next) return;
                          setDraftRangeEnd(clampRangeEnd(draftRangeStart, next));
                        }}
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setRangePickerOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="button" size="sm" onClick={applyRangePicker}>
                      Apply
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => shiftRangeByWeek(1)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-main-900)] hover:bg-[var(--neutral-50)]"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToCurrentWeek}
            disabled={isCurrentWeek}
          >
            Current week
          </Button>
        </div>
        <span className="text-xs text-[var(--text-sub-500)]">
          {visibleDates.length} day{visibleDates.length === 1 ? '' : 's'} shown
        </span>
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
          visibleDates.map((dayDate) => {
            const dow = dayOfWeekFromIso(dayDate);
            const daySlots = grouped.get(dow) ?? [];
            const isPast = isPastDate(dayDate);
            const isDropTarget = canManage && !isPast && dragOverDate === dayDate;
            const dayLabel = dayLabelFromIso(dayDate);

            return (
              <div
                key={dayDate}
                onDragOver={
                  canManage && !isPast
                    ? (e) => {
                        e.preventDefault();
                        setDragOverDate(dayDate);
                      }
                    : undefined
                }
                onDragLeave={
                  canManage
                    ? () => setDragOverDate((d) => (d === dayDate ? null : d))
                    : undefined
                }
                onDrop={
                  canManage && !isPast
                    ? (e) => {
                        e.preventDefault();
                        if (!draggingSlotId || !draggingSourceDate) return;
                        moveSlotToDay(draggingSlotId, dow, dayDate, draggingSourceDate);
                      }
                    : undefined
                }
                className={cn(
                  'rounded-xl',
                  isPast && 'opacity-70',
                  isDropTarget && 'ring-2 ring-[var(--midnight-blue-950,#01366C)]',
                )}
              >
                <ContentPanel
                  title={`${dayLabel} · ${formatDayDate(dayDate)}${isPast ? ' · Past' : ''}`}
                >
                  <div className="space-y-2 px-5 py-4">
                    {daySlots.length === 0 && (
                      <p className="text-sm text-[var(--text-sub-500)]">
                        {isPast ? 'Past — no changes allowed' : 'No classes'}
                      </p>
                    )}
                    {daySlots.map((slot) => {
                      const isPending = pendingSlotIds.has(slot.id);
                      const canDragSlot = canManage && !isPast && !isPending;

                      return (
                        <div
                          key={slot.id}
                          draggable={canDragSlot}
                          onDragStart={
                            canDragSlot
                              ? () => {
                                  setDraggingSlotId(slot.id);
                                  setDraggingSourceDate(dayDate);
                                }
                              : undefined
                          }
                          onDragEnd={
                            canManage
                              ? () => {
                                  setDraggingSlotId(null);
                                  setDraggingSourceDate(null);
                                  setDragOverDate(null);
                                }
                              : undefined
                          }
                          className={cn(
                            'flex items-start justify-between gap-3 rounded-lg border border-[var(--stroke-soft-200,#E2E4E9)] p-3 text-sm',
                            canDragSlot && 'cursor-grab active:cursor-grabbing',
                            draggingSlotId === slot.id && !isPending && 'opacity-50',
                            isPending && 'border-[var(--midnight-blue-950,#01366C)] bg-[var(--neutral-50)]',
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {canManage && !isPast && (
                              isPending ? (
                                <Loader2
                                  className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[var(--midnight-blue-950,#01366C)]"
                                  strokeWidth={2}
                                />
                              ) : (
                                <GripVertical
                                  className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-soft-400,#868C98)]"
                                  strokeWidth={1.5}
                                />
                              )
                            )}
                            <div>
                              <p className="font-medium text-[var(--text-main-900)]">
                                {slot.startTime}–{slot.endTime} · {slot.subject?.name ?? '—'}
                              </p>
                              <p className="text-[var(--text-sub-500)]">
                                {slot.batch?.name ?? '—'}
                                {slot.teacher ? ` · ${slot.teacher.fullName}` : ''}
                                {slot.room ? ` · ${slot.room}` : ''}
                              </p>
                              {isPending && (
                                <p className="mt-1 text-xs text-[var(--text-sub-500)]">Saving…</p>
                              )}
                            </div>
                          </div>
                          {canManage && !isPast && !isPending && (
                            <RowActionsMenu
                              items={[
                                {
                                  label: 'Remove',
                                  onClick: () => setDeleteSlotId(slot.id),
                                },
                              ]}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ContentPanel>
              </div>
            );
          })}
      </div>

      <ConfirmDialog
        open={deleteSlotId !== null}
        onOpenChange={(open) => !open && setDeleteSlotId(null)}
        title="Remove timetable slot?"
        description="This class will be removed from the weekly schedule."
        confirmLabel="Remove"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteSlotId) deleteMutation.mutate(deleteSlotId);
        }}
      />

      <Dialog open={showForm} onOpenChange={(open) => {
        setShowForm(open);
        if (!open) clearSlotErrors();
      }}>
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
              const dow = Number(dayOfWeek);
              if (disabledDayOfWeek.has(dow)) {
                setSlotFieldError('dayOfWeek', 'Cannot add slots for past days');
                return;
              }
              const payload = {
                branchId: effectiveBranchId,
                batchId,
                subjectId,
                dayOfWeek: dow,
                startTime,
                endTime,
                ...(teacherId ? { teacherId } : {}),
                ...(room ? { room } : {}),
              };
              if (!validateSlot(payload)) return;
              createMutation.mutate(payload);
            }}
          >
            <div>
              <SelectDropdown
                aria-label="Batch"
                placeholder="Select batch"
                value={batchId}
                onValueChange={(value) => {
                  setBatchId(value);
                  clearSlotField('batchId');
                }}
                options={[{ value: '', label: 'Select batch' }, ...(batches?.data.map((b) => ({ value: b.id, label: b.name })) ?? [])]}
                fullWidth
                className={slotFieldClassName('batchId', 'w-full')}
              />
              <FormFieldError message={slotErrors.batchId} />
            </div>
            <div>
              <SelectDropdown
                aria-label="Subject"
                placeholder="Select subject"
                value={subjectId}
                onValueChange={(value) => {
                  setSubjectId(value);
                  clearSlotField('subjectId');
                }}
                options={[{ value: '', label: 'Select subject' }, ...(subjects?.data.map((s) => ({ value: s.id, label: s.name })) ?? [])]}
                fullWidth
                className={slotFieldClassName('subjectId', 'w-full')}
              />
              <FormFieldError message={slotErrors.subjectId} />
            </div>
            <SelectDropdown
              aria-label="Teacher"
              placeholder="Teacher (optional)"
              value={teacherId}
              onValueChange={setTeacherId}
              options={[{ value: '', label: 'Teacher (optional)' }, ...(teachers?.data.map((t) => ({ value: t.id, label: t.fullName })) ?? [])]}
              fullWidth
            />
            <div>
              <SelectDropdown
                aria-label="Day of week"
                placeholder="Day"
                value={dayOfWeek}
                onValueChange={(value) => {
                  setDayOfWeek(value);
                  clearSlotField('dayOfWeek');
                }}
                options={dayOptions}
                fullWidth
                className={slotFieldClassName('dayOfWeek', 'w-full')}
              />
              <FormFieldError message={slotErrors.dayOfWeek} />
            </div>
            <div>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  clearSlotField('startTime');
                }}
                className={slotFieldClassName('startTime', '')}
                required
              />
              <FormFieldError message={slotErrors.startTime} />
            </div>
            <div>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  clearSlotField('endTime');
                }}
                className={slotFieldClassName('endTime', '')}
                required
              />
              <FormFieldError message={slotErrors.endTime} />
            </div>
            <Input
              placeholder="Room"
              value={room}
              onChange={(e) => {
                setRoom(e.target.value);
                clearSlotField('room');
              }}
              className={cn('sm:col-span-2', slotFieldClassName('room', ''))}
            />
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Save slot
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
