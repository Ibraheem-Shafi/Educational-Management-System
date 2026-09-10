'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, GripVertical, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  PERMISSIONS,
  createTimetableSlotsBulkSchema,
  updateTimetableSlotSchema,
} from '@eims/shared';
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
import { accentForSeed, paletteColor, paletteSoft } from '@/lib/ui-palette';
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

type FormMode = 'create' | 'edit';

export default function TimetablePage() {
  const { session, user } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.TIMETABLE_MANAGE);
  const isTeacherOnly = Boolean(user?.roles.includes('teacher')) && !canManage;

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
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [deleteSlotId, setDeleteSlotId] = useState<string | null>(null);

  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [room, setRoom] = useState('');
  const [highlightedSlotId, setHighlightedSlotId] = useState<string | null>(null);

  const createForm = useFormErrors(createTimetableSlotsBulkSchema);
  const editForm = useFormErrors(updateTimetableSlotSchema);
  const activeForm = formMode === 'create' ? createForm : editForm;

  useEffect(() => {
    if (isTeacherOnly && user?.id) {
      setFilterTeacherId(user.id);
    }
  }, [isTeacherOnly, user?.id]);

  const visibleDates = useMemo(
    () => daysBetween(rangeStart, rangeEnd),
    [rangeStart, rangeEnd],
  );

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

  const listFilters = useMemo(
    () => ({
      branchId: effectiveBranchId || undefined,
      batchId: filterBatchId || undefined,
      teacherId: filterTeacherId || undefined,
      subjectId: filterSubjectId || undefined,
      room: filterRoom.trim() || undefined,
    }),
    [effectiveBranchId, filterBatchId, filterTeacherId, filterSubjectId, filterRoom],
  );

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (listFilters.branchId) p.set('branchId', listFilters.branchId);
    if (listFilters.batchId) p.set('batchId', listFilters.batchId);
    if (listFilters.teacherId) p.set('teacherId', listFilters.teacherId);
    if (listFilters.subjectId) p.set('subjectId', listFilters.subjectId);
    if (listFilters.room) p.set('room', listFilters.room);
    return p.toString();
  }, [listFilters]);

  const timetableQueryKey = queryKeys.timetable(listFilters);
  const conflictsQueryKey = queryKeys.timetableConflicts(listFilters);

  const {
    data: slots,
    isLoading,
    isError: slotsError,
    refetch: refetchSlots,
  } = useQuery({
    queryKey: timetableQueryKey,
    queryFn: () => apiClient<{ data: Slot[] }>(`/timetable?${queryParams}`, { token }),
    enabled: !!token && !!effectiveBranchId,
  });

  const { data: conflicts } = useQuery({
    queryKey: conflictsQueryKey,
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

  const { data: subjects } = useSubjectsOptions(token, {
    enabled: !!effectiveBranchId,
  });

  const { data: batchSubjects } = useQuery({
    queryKey: queryKeys.batchSubjects(batchId),
    queryFn: () =>
      apiClient<{ batchId: string; subjects: { id: string; name: string; code?: string | null }[] }>(
        `/batches/${batchId}/subjects`,
        { token },
      ),
    enabled: !!token && !!batchId && formOpen,
  });

  const formSubjectOptions = useMemo(() => {
    const linked = batchSubjects?.subjects ?? [];
    if (batchId && linked.length > 0) {
      const opts = linked.map((s) => ({ value: s.id, label: s.name }));
      if (subjectId && !opts.some((o) => o.value === subjectId)) {
        const current = subjects?.data.find((s) => s.id === subjectId);
        if (current) opts.push({ value: current.id, label: current.name });
      }
      return opts;
    }
    return subjects?.data.map((s) => ({ value: s.id, label: s.name })) ?? [];
  }, [batchId, batchSubjects?.subjects, subjects?.data, subjectId]);

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

  const dayOptions = DAY_LABELS.map((d, i) => ({
    value: String(i + 1),
    label: d,
  }));

  const resetFormFields = () => {
    setBatchId('');
    setSubjectId('');
    setTeacherId('');
    setDayOfWeek('1');
    setDaysOfWeek([1]);
    setStartTime('09:00');
    setEndTime('10:00');
    setRoom('');
    setEditingSlotId(null);
    createForm.clearAll();
    editForm.clearAll();
  };

  const openCreateForm = () => {
    if (!effectiveBranchId) {
      toast.error('Select a single branch to add a timetable slot');
      return;
    }
    resetFormFields();
    setFormMode('create');
    setFormOpen(true);
  };

  const openEditForm = (slot: Slot) => {
    setFormMode('edit');
    setEditingSlotId(slot.id);
    setBatchId(slot.batchId);
    setSubjectId(slot.subjectId);
    setTeacherId(slot.teacherId ?? '');
    setDayOfWeek(String(slot.dayOfWeek));
    setDaysOfWeek([slot.dayOfWeek]);
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setRoom(slot.room ?? '');
    createForm.clearAll();
    editForm.clearAll();
    setFormOpen(true);
  };

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

  const invalidateTimetable = () => {
    queryClient.invalidateQueries({ queryKey: ['timetable'] });
    queryClient.invalidateQueries({ queryKey: ['timetable-conflicts'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.timetableStats });
  };

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient<{
        created: Slot[];
        skipped: Array<{ dayOfWeek: number; reason: string }>;
      }>('/timetable/bulk', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: (result) => {
      const createdLabels = result.created
        .map((s) => DAY_LABELS[s.dayOfWeek - 1] ?? `Day ${s.dayOfWeek}`)
        .join(', ');
      const skippedParts = result.skipped.map((s) => {
        const label = DAY_LABELS[s.dayOfWeek - 1] ?? `Day ${s.dayOfWeek}`;
        return `${label} (${s.reason})`;
      });

      if (result.created.length > 0 && result.skipped.length === 0) {
        toast.success(
          result.created.length === 1
            ? 'Slot added'
            : `Added to ${createdLabels}`,
        );
      } else if (result.created.length > 0) {
        toast.success(`Added to ${createdLabels}`);
        toast.message(`Skipped: ${skippedParts.join('; ')}`);
      }

      invalidateTimetable();
      setFormOpen(false);
      resetFormFields();
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, createForm.applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const saveEditMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiClient(`/timetable/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Slot updated');
      invalidateTimetable();
      setFormOpen(false);
      resetFormFields();
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, editForm.applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/timetable/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Slot removed');
      setDeleteSlotId(null);
      invalidateTimetable();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const moveMutation = useMutation({
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
      invalidateTimetable();
    },
  });

  const moveSlotToDay = (
    slotId: string,
    targetDayOfWeek: number,
    targetDateIso: string,
  ) => {
    setDraggingSlotId(null);
    setDraggingSourceDate(null);
    setDragOverDate(null);

    if (isPastDate(targetDateIso)) {
      toast.error('Cannot move a class onto a past date in this view');
      return;
    }

    const slot = (slots?.data ?? []).find((s) => s.id === slotId);
    if (!slot) return;

    if (slot.dayOfWeek === targetDayOfWeek) {
      toast.message('Already on that day — weekly slots apply every week');
      return;
    }

    moveMutation.mutate({ id: slotId, body: { dayOfWeek: targetDayOfWeek } });
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

  const totalVisibleSlots = slots?.data.length ?? 0;
  const formBusy = createMutation.isPending || saveEditMutation.isPending;

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={CalendarDays}
        title="Timetable"
        description="Weekly recurring schedule — drag a class to another weekday to reschedule"
        actions={
          canManage ? (
            <button
              type="button"
              onClick={openCreateForm}
              disabled={!effectiveBranchId}
              className={cn(pageHeaderActionClassName, !effectiveBranchId && 'opacity-50')}
              title={!effectiveBranchId ? 'Select a single branch first' : undefined}
            >
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
          disabled={isTeacherOnly}
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

      {effectiveBranchId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white px-3 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftRangeByWeek(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-main-900)] hover:bg-[var(--palette-teal-soft)]"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={openRangePicker}
                className="flex min-w-[200px] items-center justify-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-[var(--text-main-900)] hover:bg-[var(--palette-teal-soft)]"
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
              className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-main-900)] hover:bg-[var(--palette-teal-soft)]"
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
          <p className="text-xs text-[var(--text-sub-500)]">
            Showing the weekly schedule across {visibleDates.length} day
            {visibleDates.length === 1 ? '' : 's'}
          </p>
        </div>
      )}

      {(conflicts?.conflicts.length ?? 0) > 0 && (
        <ContentPanel title="Schedule conflicts" className="border-amber-500/50">
          <div className="space-y-1 px-5 py-4 text-sm text-amber-700">
            {conflicts?.conflicts.map((c, i) => (
              <button
                key={`${c.slotId}-${c.type}-${i}`}
                type="button"
                className="block w-full rounded-md px-2 py-1 text-left hover:bg-amber-50"
                onClick={() => {
                  setHighlightedSlotId(c.slotId);
                  const el = document.getElementById(`timetable-slot-${c.slotId}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  window.setTimeout(() => setHighlightedSlotId(null), 2500);
                }}
              >
                {c.type}: {c.message}
              </button>
            ))}
          </div>
        </ContentPanel>
      )}

      {effectiveBranchId && slotsError && (
        <ContentPanel title="Could not load timetable">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <p className="text-sm text-red-600">Something went wrong loading slots.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void refetchSlots()}>
              Retry
            </Button>
          </div>
        </ContentPanel>
      )}

      {effectiveBranchId && !isLoading && !slotsError && totalVisibleSlots === 0 && (
        <ContentPanel title="No classes scheduled">
          <p className="px-5 py-4 text-sm text-[var(--text-sub-500)]">
            No timetable slots match the current branch and filters.
            {canManage ? ' Use Add slot to create the weekly schedule.' : ''}
          </p>
        </ContentPanel>
      )}

      {isLoading && (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-[var(--palette-navy-soft)]" />
          ))}
        </div>
      )}

      {effectiveBranchId && !slotsError && (
        <div className="grid gap-4 lg:grid-cols-2">
          {!isLoading &&
            visibleDates.map((dayDate) => {
              const dow = dayOfWeekFromIso(dayDate);
              const isToday = dayDate === todayIso();
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
                          if (!draggingSlotId) return;
                          moveSlotToDay(draggingSlotId, dow, dayDate);
                        }
                      : undefined
                  }
                  className={cn(
                    'rounded-xl',
                    isPast && 'opacity-70',
                    isToday && 'ring-2 ring-[var(--palette-teal)]',
                    isDropTarget && 'ring-2 ring-[var(--midnight-blue-950,#01366C)]',
                  )}
                >
                  <ContentPanel
                    title={`${dayLabel} · ${formatDayDate(dayDate)}${isPast ? ' · Past' : ''}`}
                  >
                    <div className="space-y-2 px-5 py-4">
                      {daySlots.length === 0 && (
                        <div className="rounded-lg border border-dashed border-[var(--palette-yellow)]/50 bg-[var(--palette-yellow-soft)] px-3 py-6 text-center text-sm text-[var(--text-sub-500)]">
                          No classes
                        </div>
                      )}
                      {daySlots.map((slot) => {
                        const isPending = pendingSlotIds.has(slot.id);
                        const canDragSlot = canManage && !isPast && !isPending;
                        const accent = accentForSeed(slot.subjectId);

                        return (
                          <div
                            id={`timetable-slot-${slot.id}`}
                            key={`${slot.id}-${dayDate}`}
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
                              'flex items-start justify-between gap-3 rounded-lg border border-[var(--stroke-soft-200,#E2E4E9)] border-l-[3px] p-3 text-sm',
                              canDragSlot && 'cursor-grab active:cursor-grabbing',
                              draggingSlotId === slot.id && !isPending && 'opacity-50',
                              isPending &&
                                'border-[var(--midnight-blue-950,#01366C)] bg-[var(--palette-navy-soft)]',
                              highlightedSlotId === slot.id &&
                                'ring-2 ring-amber-500 border-amber-400',
                            )}
                            style={
                              isPending
                                ? undefined
                                : {
                                    backgroundColor: paletteSoft(accent),
                                    borderLeftColor: paletteColor(accent),
                                  }
                            }
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
                            {canManage && !isPending && (
                              <RowActionsMenu
                                items={[
                                  {
                                    label: 'Edit',
                                    onClick: () => openEditForm(slot),
                                  },
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
      )}

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

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) resetFormFields();
        }}
      >
        <DialogContent>
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <div>
              <DialogTitle>
                {formMode === 'create' ? 'New timetable slot' : 'Edit timetable slot'}
              </DialogTitle>
              <DialogDescription>
                {formMode === 'create'
                  ? 'Add a class to one or more weekdays in the weekly schedule.'
                  : 'Update this weekly recurring class.'}
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="text-[var(--text-sub-500)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form
            className="grid gap-4 px-5 sm:grid-cols-2"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!effectiveBranchId) {
                toast.error('Select a single branch first');
                return;
              }
              if (formMode === 'create') {
                const payload = {
                  branchId: effectiveBranchId,
                  batchId,
                  subjectId,
                  daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : [],
                  startTime,
                  endTime,
                  teacherId: teacherId || null,
                  room: room || null,
                };
                if (!createForm.validate(payload)) return;
                createMutation.mutate(payload);
                return;
              }
              if (!editingSlotId) return;
              const dow = Number(dayOfWeek);
              const payload = {
                batchId,
                subjectId,
                dayOfWeek: dow,
                startTime,
                endTime,
                teacherId: teacherId || null,
                room: room || null,
              };
              if (!editForm.validate(payload)) return;
              saveEditMutation.mutate({ id: editingSlotId, body: payload });
            }}
          >
            <div>
              <SelectDropdown
                aria-label="Batch"
                placeholder="Select batch"
                value={batchId}
                onValueChange={(value) => {
                  setBatchId(value);
                  setSubjectId('');
                  activeForm.clearField('batchId');
                  activeForm.clearField('subjectId');
                }}
                options={[
                  { value: '', label: 'Select batch' },
                  ...(batches?.data.map((b) => ({ value: b.id, label: b.name })) ?? []),
                ]}
                fullWidth
                className={activeForm.fieldClassName('batchId', 'w-full')}
              />
              <FormFieldError message={activeForm.errors.batchId} />
            </div>
            <div>
              <SelectDropdown
                aria-label="Subject"
                placeholder={batchId ? 'Select subject' : 'Select batch first'}
                value={subjectId}
                onValueChange={(value) => {
                  setSubjectId(value);
                  activeForm.clearField('subjectId');
                }}
                options={[
                  { value: '', label: batchId ? 'Select subject' : 'Select batch first' },
                  ...formSubjectOptions,
                ]}
                fullWidth
                className={activeForm.fieldClassName('subjectId', 'w-full')}
                disabled={!batchId}
              />
              <FormFieldError message={activeForm.errors.subjectId} />
            </div>
            <div>
              <SelectDropdown
                aria-label="Teacher"
                placeholder="Teacher (optional)"
                value={teacherId}
                onValueChange={(value) => {
                  setTeacherId(value);
                  activeForm.clearField('teacherId');
                }}
                options={[
                  { value: '', label: 'Teacher (optional)' },
                  ...(teachers?.data.map((t) => ({ value: t.id, label: t.fullName })) ?? []),
                ]}
                fullWidth
                className={activeForm.fieldClassName('teacherId', 'w-full')}
              />
              <FormFieldError message={activeForm.errors.teacherId} />
            </div>
            {formMode === 'edit' ? (
              <div>
                <SelectDropdown
                  aria-label="Day of week"
                  placeholder="Day"
                  value={dayOfWeek}
                  onValueChange={(value) => {
                    setDayOfWeek(value);
                    activeForm.clearField('dayOfWeek');
                  }}
                  options={dayOptions}
                  fullWidth
                  className={activeForm.fieldClassName('dayOfWeek', 'w-full')}
                />
                <FormFieldError message={activeForm.errors.dayOfWeek} />
              </div>
            ) : (
              <div className="sm:col-span-2">
                <p className="mb-2 text-sm font-medium text-[var(--text-main-900)]">Days</p>
                <div className="mb-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDaysOfWeek([1, 2, 3, 4, 5]);
                      createForm.clearField('daysOfWeek');
                    }}
                  >
                    Weekdays
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDaysOfWeek([1, 2, 3, 4, 5, 6, 7]);
                      createForm.clearField('daysOfWeek');
                    }}
                  >
                    All days
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDaysOfWeek([]);
                      createForm.clearField('daysOfWeek');
                    }}
                  >
                    Clear
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DAY_LABELS.map((label, i) => {
                    const dow = i + 1;
                    const checked = daysOfWeek.includes(dow);
                    return (
                      <label
                        key={dow}
                        className={cn(
                          'inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm',
                          checked
                            ? 'border-[var(--midnight-blue-950,#01366C)] bg-[var(--neutral-50)]'
                            : 'border-[var(--stroke-soft-200,#E2E4E9)]',
                          createForm.errors.daysOfWeek && 'border-red-500',
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => {
                            setDaysOfWeek((prev) =>
                              checked ? prev.filter((d) => d !== dow) : [...prev, dow].sort((a, b) => a - b),
                            );
                            createForm.clearField('daysOfWeek');
                          }}
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
                <FormFieldError message={createForm.errors.daysOfWeek} />
              </div>
            )}
            <div>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  activeForm.clearField('startTime');
                }}
                className={activeForm.fieldClassName('startTime', '')}
              />
              <FormFieldError message={activeForm.errors.startTime} />
            </div>
            <div>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  activeForm.clearField('endTime');
                }}
                className={activeForm.fieldClassName('endTime', '')}
              />
              <FormFieldError message={activeForm.errors.endTime} />
            </div>
            <div className="sm:col-span-2">
              <Input
                placeholder="Room"
                value={room}
                onChange={(e) => {
                  setRoom(e.target.value);
                  activeForm.clearField('room');
                }}
                className={activeForm.fieldClassName('room', '')}
              />
              <FormFieldError message={activeForm.errors.room} />
            </div>
            <FormFieldError message={activeForm.errors.branchId} />
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={formBusy || !effectiveBranchId}>
                {formMode === 'create' ? 'Save slot' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
