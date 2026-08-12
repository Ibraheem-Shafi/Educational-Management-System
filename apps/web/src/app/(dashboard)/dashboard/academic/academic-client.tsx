'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS, updateAcademicSessionSchema } from '@eims/shared';
import type { AcademicStatsResponse, PaginatedResponse, ProgramListItem } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { withBranchScope } from '@/lib/branch-scope';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { FormFieldError } from '@/components/forms/form-field-error';
import { queryKeys } from '@/lib/query-keys';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { MainStatsSection, type MainStatItem } from '@/components/layout/main-stats-section';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FilterBar } from '@/components/layout/filter-bar';
import { Tabs } from '@/components/ui/tabs';
import { ContentPanel } from '@/components/layout/content-panel';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { StatusBadge } from '@/components/layout/status-badge';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { CreateBatchDialog } from '@/components/features/academic/create-batch-dialog';
import { EditBatchDialog } from '@/components/features/academic/edit-batch-dialog';
import { CreateSubjectDialog } from '@/components/features/academic/create-subject-dialog';
import { EditSubjectDialog } from '@/components/features/academic/edit-subject-dialog';
import { CreateSessionDialog } from '@/components/features/academic/create-session-dialog';
import { cn } from '@/lib/utils';

const ACTIVE_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

const CURRENT_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Current' },
];

const thClass =
  'h-9 border-0 bg-[#F8F8F8] px-4 text-left text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] first:rounded-l-lg last:rounded-r-lg';
const tdClass =
  'border-0 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-3 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900,#0A0D14)]';

type AcademicTab = 'programs' | 'batches' | 'subjects' | 'sessions';

interface Subject {
  id: string;
  name: string;
  code: string | null;
}

interface Batch {
  id: string;
  name: string;
  program?: { name: string };
}

interface Session {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

function tabStats(tab: AcademicTab, stats?: AcademicStatsResponse): MainStatItem[] {
  if (!stats) {
    return [
      { label: 'Programs', value: 0 },
      { label: 'Batches', value: 0 },
      { label: 'Subjects', value: 0 },
      { label: 'Sessions', value: 0 },
    ];
  }

  const all: MainStatItem[] = [
    { label: 'Programs', value: stats.programs.total, changePercent: stats.programs.changePercent },
    { label: 'Batches', value: stats.batches.total, changePercent: stats.batches.changePercent },
    { label: 'Subjects', value: stats.subjects.total, changePercent: stats.subjects.changePercent },
    { label: 'Sessions', value: stats.sessions.total, changePercent: stats.sessions.changePercent },
  ];

  const order: Record<AcademicTab, number[]> = {
    programs: [0, 1, 2, 3],
    batches: [1, 0, 2, 3],
    subjects: [2, 0, 1, 3],
    sessions: [3, 0, 1, 2],
  };

  return order[tab].map((i) => all[i]);
}

export default function AcademicPage() {
  const router = useRouter();
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.ACADEMIC_MANAGE);
  const [tab, setTab] = useState<AcademicTab>('programs');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [programSearch, setProgramSearch] = useState('');
  const [programIsActive, setProgramIsActive] = useState('');
  const [batchSearch, setBatchSearch] = useState('');
  const [batchProgramId, setBatchProgramId] = useState('');
  const [batchIsActive, setBatchIsActive] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectIsActive, setSubjectIsActive] = useState('');
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionIsCurrent, setSessionIsCurrent] = useState('');

  const [createBatchOpen, setCreateBatchOpen] = useState(false);
  const [createSubjectOpen, setCreateSubjectOpen] = useState(false);
  const [createSessionOpen, setCreateSessionOpen] = useState(false);
  const [editBatch, setEditBatch] = useState<{ id: string; name: string } | null>(null);
  const [editSubject, setEditSubject] = useState<{
    id: string;
    name: string;
    code: string | null;
  } | null>(null);
  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [editSessionName, setEditSessionName] = useState('');
  const [editSessionStart, setEditSessionStart] = useState('');
  const [editSessionEnd, setEditSessionEnd] = useState('');
  const [editSessionCurrent, setEditSessionCurrent] = useState(false);
  const {
    errors: sessionErrors,
    validate: validateSession,
    clearField: clearSessionField,
    fieldClassName: sessionFieldClassName,
    applyApiErrors: applySessionApiErrors,
    clearAll: clearSessionErrors,
  } = useFormErrors(updateAcademicSessionSchema);

  const { effectiveScope, scopeKey, singleBranchId } = useEffectiveBranchScope();

  const handleTabChange = (next: string) => {
    setTab(next as AcademicTab);
    setPage(1);
  };

  const handleProgramSearchChange = useCallback((value: string) => {
    setProgramSearch(value);
    setPage(1);
  }, []);

  const handleBatchSearchChange = useCallback((value: string) => {
    setBatchSearch(value);
    setPage(1);
  }, []);

  const handleSubjectSearchChange = useCallback((value: string) => {
    setSubjectSearch(value);
    setPage(1);
  }, []);

  const handleSessionSearchChange = useCallback((value: string) => {
    setSessionSearch(value);
    setPage(1);
  }, []);

  const subjectsQueryParams = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (subjectSearch) params.set('search', subjectSearch);
    if (subjectIsActive) params.set('isActive', subjectIsActive);
    return params.toString();
  }, [page, limit, subjectSearch, subjectIsActive]);

  const sessionsQueryParams = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (sessionSearch) params.set('search', sessionSearch);
    if (sessionIsCurrent) params.set('isCurrent', sessionIsCurrent);
    return params.toString();
  }, [page, limit, sessionSearch, sessionIsCurrent]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: [...queryKeys.academicStats(tab), scopeKey],
    queryFn: () =>
      apiClient<AcademicStatsResponse>(withBranchScope('/academic/stats', effectiveScope), {
        token,
      }),
    enabled: !!token,
  });

  const { data: programs, isLoading: programsLoading } = useQuery({
    queryKey: queryKeys.programs(scopeKey, {
      page,
      limit,
      search: programSearch || undefined,
      isActive: programIsActive || undefined,
    }),
    queryFn: () =>
      apiClient<PaginatedResponse<ProgramListItem>>(
        withBranchScope('/programs', effectiveScope, {
          page,
          limit,
          search: programSearch || undefined,
          isActive: programIsActive || undefined,
        }),
        { token },
      ),
    enabled: !!token && tab === 'programs',
    placeholderData: (previous) => previous,
  });

  const { data: programOptionsData } = useQuery({
    queryKey: queryKeys.programs(scopeKey, { options: true, limit: 100 }),
    queryFn: () =>
      apiClient<PaginatedResponse<ProgramListItem>>(
        withBranchScope('/programs', effectiveScope, { limit: 100 }),
        { token },
      ),
    enabled: !!token && (tab === 'batches' || createBatchOpen),
  });

  const { data: subjects, isLoading: subjectsLoading } = useQuery({
    queryKey: [...queryKeys.subjects, { page, limit, search: subjectSearch, isActive: subjectIsActive }],
    queryFn: () =>
      apiClient<PaginatedResponse<Subject>>(`/subjects?${subjectsQueryParams}`, { token }),
    enabled: !!token && tab === 'subjects',
    placeholderData: (previous) => previous,
  });

  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: queryKeys.batches(scopeKey, batchProgramId || undefined, {
      page,
      limit,
      search: batchSearch || undefined,
      isActive: batchIsActive || undefined,
    }),
    queryFn: () =>
      apiClient<PaginatedResponse<Batch>>(
        withBranchScope('/batches', effectiveScope, {
          page,
          limit,
          search: batchSearch || undefined,
          programId: batchProgramId || undefined,
          isActive: batchIsActive || undefined,
        }),
        { token },
      ),
    enabled: !!token && tab === 'batches',
    placeholderData: (previous) => previous,
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: queryKeys.academicSessions({
      page,
      limit,
      search: sessionSearch || undefined,
      isCurrent: sessionIsCurrent || undefined,
    }),
    queryFn: () =>
      apiClient<PaginatedResponse<Session>>(`/academic-sessions?${sessionsQueryParams}`, { token }),
    enabled: !!token && tab === 'sessions',
    placeholderData: (previous) => previous,
  });


  const programOptions = useMemo(
    () => (programOptionsData?.data ?? []).map((p) => ({ value: p.id, label: p.name })),
    [programOptionsData],
  );

  const invalidateAcademic = () => {
    queryClient.invalidateQueries({ queryKey: ['programs'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.programs() });
    queryClient.invalidateQueries({ queryKey: ['batches'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.subjects });
    queryClient.invalidateQueries({ queryKey: queryKeys.academicSessions() });
    queryClient.invalidateQueries({ queryKey: queryKeys.academicStats() });
  };

  const updateSession = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiClient(`/academic-sessions/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Session updated');
      invalidateAcademic();
      setEditSessionId(null);
      clearSessionErrors();
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applySessionApiErrors)) return;
      toast.error(err.message);
    },
  });

  const createAction = (() => {
    if (tab === 'programs') {
      return {
        label: 'Add program',
        onClick: () => router.push('/dashboard/academic/programs/new'),
      };
    }
    if (tab === 'batches') return { label: 'Add batch', onClick: () => setCreateBatchOpen(true) };
    if (tab === 'subjects') return { label: 'Add subject', onClick: () => setCreateSubjectOpen(true) };
    if (tab === 'sessions') return { label: 'Add session', onClick: () => setCreateSessionOpen(true) };
    return null;
  })();

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={BookOpen}
        title="Academic"
        description="Programs, batches, and subjects"
        actions={
          canManage && createAction ? (
            <button type="button" onClick={createAction.onClick} className={pageHeaderActionClassName}>
              <PageHeaderActionIcon />
              {createAction.label}
            </button>
          ) : undefined
        }
      />

      <Tabs
        aria-label="Academic sections"
        tabs={[
          { id: 'programs', label: 'Programs' },
          { id: 'batches', label: 'Batches' },
          { id: 'subjects', label: 'Subjects' },
          { id: 'sessions', label: 'Sessions' },
        ]}
        value={tab}
        onValueChange={handleTabChange}
      />

      <MainStatsSection isLoading={statsLoading} stats={tabStats(tab, stats)} />

      {tab === 'programs' && (
        <>
          <FilterBar className="items-center">
            <SearchInput value={programSearch} onValueChange={handleProgramSearchChange} />
            <SelectDropdown
              aria-label="Filter by status"
              placeholder="All"
              value={programIsActive}
              onValueChange={(next) => {
                setProgramIsActive(next);
                setPage(1);
              }}
              options={ACTIVE_FILTER_OPTIONS}
            />
            {(programSearch || programIsActive) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setProgramSearch('');
                  setProgramIsActive('');
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
            <PageBranchScopeControl />
          </FilterBar>

        <ContentPanel title={`Programs (${programs?.meta.total ?? 0})`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={thClass}>Name</th>
                  <th className={thClass}>Code</th>
                  <th className={thClass}>Batches</th>
                  <th className={cn(thClass, 'w-12')} />
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {programsLoading ? (
                  <DataTableSkeletonRows columns={4} rows={limit} />
                ) : (programs?.data.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]">
                      No programs found
                    </td>
                  </tr>
                ) : (
                  programs?.data.map((p) => (
                    <tr key={p.id} className="hover:bg-[var(--neutral-50)]/50">
                      <td className={tdClass}>{p.name}</td>
                      <td className={tdClass}>{p.code ?? '—'}</td>
                      <td className={tdClass}>
                        {p.batches.length
                          ? p.batches.map((b) => b.name).join(', ')
                          : '—'}
                      </td>
                      <td className={cn(tdClass, 'text-right')}>
                        {canManage ? (
                          <RowActionsMenu
                            items={[
                              {
                                label: 'Edit',
                                onClick: () =>
                                  router.push(`/dashboard/academic/programs/${p.id}/edit`),
                              },
                            ]}
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {programs?.meta && (
            <PaginationBar
              page={page}
              totalPages={programs.meta.totalPages}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          )}
        </ContentPanel>
        </>
      )}

      {tab === 'batches' && (
        <>
          <FilterBar className="items-center">
            <SearchInput value={batchSearch} onValueChange={handleBatchSearchChange} />
            <SelectDropdown
              aria-label="Filter by program"
              placeholder="All programs"
              value={batchProgramId}
              onValueChange={(next) => {
                setBatchProgramId(next);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All programs' },
                ...programOptions,
              ]}
            />
            <SelectDropdown
              aria-label="Filter by status"
              placeholder="All"
              value={batchIsActive}
              onValueChange={(next) => {
                setBatchIsActive(next);
                setPage(1);
              }}
              options={ACTIVE_FILTER_OPTIONS}
            />
            {(batchSearch || batchProgramId || batchIsActive) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setBatchSearch('');
                  setBatchProgramId('');
                  setBatchIsActive('');
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
            <PageBranchScopeControl />
          </FilterBar>

        <ContentPanel title={`Batches (${batches?.meta.total ?? 0})`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={thClass}>Name</th>
                  <th className={thClass}>Program</th>
                  <th className={cn(thClass, 'w-12')} />
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {batchesLoading ? (
                  <DataTableSkeletonRows columns={3} rows={limit} />
                ) : (batches?.data.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]">
                      No batches found
                    </td>
                  </tr>
                ) : (
                  batches?.data.map((b) => (
                    <tr key={b.id} className="hover:bg-[var(--neutral-50)]/50">
                      <td className={tdClass}>{b.name}</td>
                      <td className={tdClass}>{b.program?.name ?? '—'}</td>
                      <td className={cn(tdClass, 'text-right')}>
                        {canManage ? (
                          <RowActionsMenu
                            items={[
                              {
                                label: 'Edit',
                                onClick: () => setEditBatch({ id: b.id, name: b.name }),
                              },
                            ]}
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {batches?.meta && (
            <PaginationBar
              page={page}
              totalPages={batches.meta.totalPages}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          )}
        </ContentPanel>
        </>
      )}

      {tab === 'sessions' && (
        <>
          <FilterBar className="items-center">
            <SearchInput value={sessionSearch} onValueChange={handleSessionSearchChange} />
            <SelectDropdown
              aria-label="Filter by current session"
              placeholder="All"
              value={sessionIsCurrent}
              onValueChange={(next) => {
                setSessionIsCurrent(next);
                setPage(1);
              }}
              options={CURRENT_FILTER_OPTIONS}
            />
            {(sessionSearch || sessionIsCurrent) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSessionSearch('');
                  setSessionIsCurrent('');
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterBar>

        <ContentPanel title={`Sessions (${sessions?.meta.total ?? 0})`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={thClass}>Name</th>
                  <th className={thClass}>Period</th>
                  <th className={thClass}>Status</th>
                  <th className={cn(thClass, 'w-12')} />
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {sessionsLoading ? (
                  <DataTableSkeletonRows columns={4} rows={limit} />
                ) : (sessions?.data.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]">
                      No sessions found
                    </td>
                  </tr>
                ) : (
                  sessions?.data.map((s) => (
                    <tr key={s.id} className="hover:bg-[var(--neutral-50)]/50">
                      {editSessionId === s.id ? (
                        <>
                          <td className={tdClass}>
                            <Input
                              className={sessionFieldClassName('name', '')}
                              value={editSessionName}
                              onChange={(e) => {
                                setEditSessionName(e.target.value);
                                clearSessionField('name');
                              }}
                            />
                            <FormFieldError message={sessionErrors.name} />
                          </td>
                          <td className={tdClass}>
                            <div className="flex gap-2">
                              <Input
                                type="date"
                                className={sessionFieldClassName('startDate', '')}
                                value={editSessionStart}
                                onChange={(e) => {
                                  setEditSessionStart(e.target.value);
                                  clearSessionField('startDate');
                                }}
                              />
                              <Input
                                type="date"
                                className={sessionFieldClassName('endDate', '')}
                                value={editSessionEnd}
                                min={editSessionStart || undefined}
                                onChange={(e) => {
                                  setEditSessionEnd(e.target.value);
                                  clearSessionField('endDate');
                                }}
                              />
                            </div>
                            <FormFieldError
                              message={sessionErrors.startDate ?? sessionErrors.endDate}
                            />
                          </td>
                          <td className={tdClass}>
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={editSessionCurrent}
                                onChange={(e) => setEditSessionCurrent(e.target.checked)}
                              />
                              Current
                            </label>
                          </td>
                          <td className={cn(tdClass, 'text-right')}>
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                disabled={updateSession.isPending}
                                onClick={() => {
                                  const body = {
                                    name: editSessionName.trim(),
                                    startDate: new Date(editSessionStart).toISOString(),
                                    endDate: new Date(editSessionEnd).toISOString(),
                                    isCurrent: editSessionCurrent,
                                  };
                                  if (!validateSession(body)) return;
                                  updateSession.mutate({ id: s.id, body });
                                }}
                              >
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => {
                                setEditSessionId(null);
                                clearSessionErrors();
                              }}>
                                Cancel
                              </Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className={tdClass}>{s.name}</td>
                          <td className={tdClass}>
                            {s.startDate.slice(0, 10)} – {s.endDate.slice(0, 10)}
                          </td>
                          <td className={tdClass}>
                            {s.isCurrent ? <StatusBadge label="Current" code="active" /> : '—'}
                          </td>
                          <td className={cn(tdClass, 'text-right')}>
                            {canManage ? (
                              <RowActionsMenu
                                items={[
                                  {
                                    label: 'Edit',
                                    onClick: () => {
                                      clearSessionErrors();
                                      setEditSessionId(s.id);
                                      setEditSessionName(s.name);
                                      setEditSessionStart(s.startDate.slice(0, 10));
                                      setEditSessionEnd(s.endDate.slice(0, 10));
                                      setEditSessionCurrent(s.isCurrent);
                                    },
                                  },
                                ]}
                              />
                            ) : null}
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {sessions?.meta && (
            <PaginationBar
              page={page}
              totalPages={sessions.meta.totalPages}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          )}
        </ContentPanel>
        </>
      )}

      {tab === 'subjects' && (
        <>
          <FilterBar className="items-center">
            <SearchInput value={subjectSearch} onValueChange={handleSubjectSearchChange} />
            <SelectDropdown
              aria-label="Filter by status"
              placeholder="All"
              value={subjectIsActive}
              onValueChange={(next) => {
                setSubjectIsActive(next);
                setPage(1);
              }}
              options={ACTIVE_FILTER_OPTIONS}
            />
            {(subjectSearch || subjectIsActive) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSubjectSearch('');
                  setSubjectIsActive('');
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterBar>

        <ContentPanel title={`Subjects (${subjects?.meta.total ?? 0})`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={thClass}>Name</th>
                  <th className={thClass}>Code</th>
                  <th className={cn(thClass, 'w-12')} />
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {subjectsLoading ? (
                  <DataTableSkeletonRows columns={3} rows={limit} />
                ) : (subjects?.data.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]">
                      No subjects found
                    </td>
                  </tr>
                ) : (
                  subjects?.data.map((s) => (
                    <tr key={s.id} className="hover:bg-[var(--neutral-50)]/50">
                      <td className={tdClass}>{s.name}</td>
                      <td className={tdClass}>{s.code ?? '—'}</td>
                      <td className={cn(tdClass, 'text-right')}>
                        {canManage ? (
                          <RowActionsMenu
                            items={[
                              {
                                label: 'Edit',
                                onClick: () =>
                                  setEditSubject({
                                    id: s.id,
                                    name: s.name,
                                    code: s.code,
                                  }),
                              },
                            ]}
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {subjects?.meta && (
            <PaginationBar
              page={page}
              totalPages={subjects.meta.totalPages}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          )}
        </ContentPanel>
        </>
      )}

      <CreateBatchDialog
        open={createBatchOpen}
        onOpenChange={setCreateBatchOpen}
        branchId={singleBranchId ?? ''}
        programOptions={programOptions}
      />
      <EditBatchDialog
        open={!!editBatch}
        onOpenChange={(open) => {
          if (!open) setEditBatch(null);
        }}
        batch={editBatch}
      />
      <CreateSubjectDialog open={createSubjectOpen} onOpenChange={setCreateSubjectOpen} />
      <EditSubjectDialog
        open={!!editSubject}
        onOpenChange={(open) => {
          if (!open) setEditSubject(null);
        }}
        subject={editSubject}
      />
      <CreateSessionDialog open={createSessionOpen} onOpenChange={setCreateSessionOpen} />
    </div>
  );
}
