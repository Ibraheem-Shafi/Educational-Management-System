'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, X } from 'lucide-react';
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
import { MainStatsSection, type MainStatItem } from '@/components/layout/main-stats-section';
import { PageTabs } from '@/components/layout/page-tabs';
import { ContentPanel } from '@/components/layout/content-panel';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { StatusBadge } from '@/components/layout/status-badge';
import type { AcademicStatsResponse } from '@eims/types';
import { cn } from '@/lib/utils';

const thClass =
  'h-9 border-0 bg-[#F8F8F8] px-4 text-left text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] first:rounded-l-lg last:rounded-r-lg';
const tdClass =
  'border-0 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-3 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900,#0A0D14)]';

type AcademicTab = 'programs' | 'batches' | 'subjects' | 'sessions' | 'assignments';

interface Branch {
  id: string;
  name: string;
}

interface Program {
  id: string;
  name: string;
  code: string | null;
  branchId: string;
}

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
    assignments: [1, 2, 0, 3],
  };

  return order[tab].map((i) => all[i]);
}

export default function AcademicPage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AcademicTab>('programs');
  const [branchId, setBranchId] = useState(user?.branchId ?? '');

  const [createProgramOpen, setCreateProgramOpen] = useState(false);
  const [createBatchOpen, setCreateBatchOpen] = useState(false);
  const [createSubjectOpen, setCreateSubjectOpen] = useState(false);
  const [createSessionOpen, setCreateSessionOpen] = useState(false);

  const [programName, setProgramName] = useState('');
  const [programCode, setProgramCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [batchName, setBatchName] = useState('');
  const [batchProgramId, setBatchProgramId] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [sessionStart, setSessionStart] = useState('');
  const [sessionEnd, setSessionEnd] = useState('');
  const [assignBatchId, setAssignBatchId] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);

  const [editProgramId, setEditProgramId] = useState<string | null>(null);
  const [editProgramName, setEditProgramName] = useState('');
  const [editProgramCode, setEditProgramCode] = useState('');
  const [editBatchId, setEditBatchId] = useState<string | null>(null);
  const [editBatchName, setEditBatchName] = useState('');
  const [editSubjectId, setEditSubjectId] = useState<string | null>(null);
  const [editSubjectName, setEditSubjectName] = useState('');
  const [editSubjectCode, setEditSubjectCode] = useState('');
  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [editSessionName, setEditSessionName] = useState('');
  const [editSessionStart, setEditSessionStart] = useState('');
  const [editSessionEnd, setEditSessionEnd] = useState('');
  const [editSessionCurrent, setEditSessionCurrent] = useState(false);

  const { data: branches } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: () => apiClient<{ data: Branch[] }>('/branches', { token }),
    enabled: !!token,
  });

  const effectiveBranchId = branchId || user?.branchId || branches?.data[0]?.id || '';

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.academicStats(tab),
    queryFn: () => apiClient<AcademicStatsResponse>('/academic/stats', { token }),
    enabled: !!token,
  });

  const { data: programs, isLoading: programsLoading } = useQuery({
    queryKey: ['programs', effectiveBranchId],
    queryFn: () =>
      apiClient<{ data: Program[] }>(`/programs?branchId=${effectiveBranchId}`, { token }),
    enabled: !!token && !!effectiveBranchId && (tab === 'programs' || tab === 'batches' || tab === 'assignments'),
  });

  const { data: subjects, isLoading: subjectsLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => apiClient<{ data: Subject[] }>('/subjects', { token }),
    enabled: !!token && (tab === 'subjects' || tab === 'assignments'),
  });

  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ['batches', effectiveBranchId],
    queryFn: () =>
      apiClient<{ data: Batch[] }>(`/batches?branchId=${effectiveBranchId}`, { token }),
    enabled: !!token && !!effectiveBranchId && (tab === 'batches' || tab === 'assignments'),
  });

  const { data: batchSubjects } = useQuery({
    queryKey: ['batch-subjects', assignBatchId],
    queryFn: () =>
      apiClient<{ subjects: Subject[] }>(`/batches/${assignBatchId}/subjects`, { token }),
    enabled: !!token && !!assignBatchId && tab === 'assignments',
  });

  useEffect(() => {
    if (!batchSubjects) return;
    setSelectedSubjectIds(batchSubjects.subjects.map((s) => s.id));
  }, [batchSubjects]);

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['academic-sessions'],
    queryFn: () => apiClient<{ data: Session[] }>('/academic-sessions', { token }),
    enabled: !!token && tab === 'sessions',
  });

  const branchOptions = useMemo(
    () => (branches?.data ?? []).map((b) => ({ value: b.id, label: b.name })),
    [branches],
  );

  const programOptions = useMemo(
    () => (programs?.data ?? []).map((p) => ({ value: p.id, label: p.name })),
    [programs],
  );

  const batchOptions = useMemo(
    () => [
      { value: '', label: 'Select batch' },
      ...(batches?.data ?? []).map((b) => ({ value: b.id, label: b.name })),
    ],
    [batches],
  );

  const invalidateAcademic = () => {
    queryClient.invalidateQueries({ queryKey: ['programs'] });
    queryClient.invalidateQueries({ queryKey: ['batches'] });
    queryClient.invalidateQueries({ queryKey: ['subjects'] });
    queryClient.invalidateQueries({ queryKey: ['academic-sessions'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.academicStats() });
  };

  const createProgram = useMutation({
    mutationFn: (body: { branchId: string; name: string; code?: string }) =>
      apiClient('/programs', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Program created');
      invalidateAcademic();
      setProgramName('');
      setProgramCode('');
      setCreateProgramOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createBatch = useMutation({
    mutationFn: (body: { branchId: string; programId: string; name: string }) =>
      apiClient('/batches', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Batch created');
      invalidateAcademic();
      setBatchName('');
      setCreateBatchOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createSession = useMutation({
    mutationFn: (body: { name: string; startDate: string; endDate: string; isCurrent?: boolean }) =>
      apiClient('/academic-sessions', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Session created');
      invalidateAcademic();
      setSessionName('');
      setCreateSessionOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createSubject = useMutation({
    mutationFn: (body: { name: string; code?: string }) =>
      apiClient('/subjects', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Subject created');
      invalidateAcademic();
      setSubjectName('');
      setSubjectCode('');
      setCreateSubjectOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateProgram = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiClient(`/programs/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Program updated');
      invalidateAcademic();
      setEditProgramId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateBatch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiClient(`/batches/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Batch updated');
      invalidateAcademic();
      setEditBatchId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateSubject = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiClient(`/subjects/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Subject updated');
      invalidateAcademic();
      setEditSubjectId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateSession = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiClient(`/academic-sessions/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Session updated');
      invalidateAcademic();
      setEditSessionId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveBatchSubjects = useMutation({
    mutationFn: () =>
      apiClient(`/batches/${assignBatchId}/subjects`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ subjectIds: selectedSubjectIds }),
      }),
    onSuccess: () => {
      toast.success('Batch subjects saved');
      queryClient.invalidateQueries({ queryKey: ['batch-subjects', assignBatchId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createAction = (() => {
    if (tab === 'programs') return { label: 'Add program', onClick: () => setCreateProgramOpen(true) };
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
          createAction ? (
            <button type="button" onClick={createAction.onClick} className={pageHeaderActionClassName}>
              <PageHeaderActionIcon />
              {createAction.label}
            </button>
          ) : undefined
        }
      />

      <PageTabs
        tabs={[
          { id: 'programs', label: 'Programs' },
          { id: 'batches', label: 'Batches' },
          { id: 'subjects', label: 'Subjects' },
          { id: 'sessions', label: 'Sessions' },
          { id: 'assignments', label: 'Batch subjects' },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as AcademicTab)}
      />

      {!user?.branchId && tab !== 'subjects' && tab !== 'sessions' && (
        <SelectDropdown
          aria-label="Branch"
          placeholder="Select branch"
          value={branchId}
          onValueChange={setBranchId}
          options={branchOptions}
        />
      )}

      <MainStatsSection isLoading={statsLoading} stats={tabStats(tab, stats)} />

      {tab === 'programs' && (
        <ContentPanel title={`Programs (${programs?.data.length ?? 0})`}>
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
                {programsLoading &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={3} className={tdClass}>
                        <div className="h-4 w-full animate-pulse rounded bg-[var(--neutral-50)]" />
                      </td>
                    </tr>
                  ))}
                {!programsLoading && programs?.data.map((p) => (
                  <tr key={p.id} className="hover:bg-[var(--neutral-50)]/50">
                    {editProgramId === p.id ? (
                      <>
                        <td className={tdClass}>
                          <Input value={editProgramName} onChange={(e) => setEditProgramName(e.target.value)} />
                        </td>
                        <td className={tdClass}>
                          <Input value={editProgramCode} onChange={(e) => setEditProgramCode(e.target.value)} />
                        </td>
                        <td className={cn(tdClass, 'text-right')}>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              disabled={updateProgram.isPending}
                              onClick={() =>
                                updateProgram.mutate({
                                  id: p.id,
                                  body: {
                                    name: editProgramName,
                                    ...(editProgramCode ? { code: editProgramCode } : {}),
                                  },
                                })
                              }
                            >
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditProgramId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={tdClass}>{p.name}</td>
                        <td className={tdClass}>{p.code ?? '—'}</td>
                        <td className={cn(tdClass, 'text-right')}>
                          <RowActionsMenu
                            items={[
                              {
                                label: 'Edit',
                                onClick: () => {
                                  setEditProgramId(p.id);
                                  setEditProgramName(p.name);
                                  setEditProgramCode(p.code ?? '');
                                },
                              },
                            ]}
                          />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ContentPanel>
      )}

      {tab === 'batches' && (
        <ContentPanel title={`Batches (${batches?.data.length ?? 0})`}>
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
                {batchesLoading &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={3} className={tdClass}>
                        <div className="h-4 w-full animate-pulse rounded bg-[var(--neutral-50)]" />
                      </td>
                    </tr>
                  ))}
                {!batchesLoading && batches?.data.map((b) => (
                  <tr key={b.id} className="hover:bg-[var(--neutral-50)]/50">
                    {editBatchId === b.id ? (
                      <>
                        <td className={tdClass}>
                          <Input value={editBatchName} onChange={(e) => setEditBatchName(e.target.value)} />
                        </td>
                        <td className={tdClass}>{b.program?.name ?? '—'}</td>
                        <td className={cn(tdClass, 'text-right')}>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              disabled={updateBatch.isPending}
                              onClick={() => updateBatch.mutate({ id: b.id, body: { name: editBatchName } })}
                            >
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditBatchId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={tdClass}>{b.name}</td>
                        <td className={tdClass}>{b.program?.name ?? '—'}</td>
                        <td className={cn(tdClass, 'text-right')}>
                          <RowActionsMenu
                            items={[
                              {
                                label: 'Edit',
                                onClick: () => {
                                  setEditBatchId(b.id);
                                  setEditBatchName(b.name);
                                },
                              },
                            ]}
                          />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ContentPanel>
      )}

      {tab === 'sessions' && (
        <ContentPanel title={`Sessions (${sessions?.data.length ?? 0})`}>
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
                {sessionsLoading &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={4} className={tdClass}>
                        <div className="h-4 w-full animate-pulse rounded bg-[var(--neutral-50)]" />
                      </td>
                    </tr>
                  ))}
                {!sessionsLoading && sessions?.data.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--neutral-50)]/50">
                    {editSessionId === s.id ? (
                      <>
                        <td className={tdClass}>
                          <Input value={editSessionName} onChange={(e) => setEditSessionName(e.target.value)} />
                        </td>
                        <td className={tdClass}>
                          <div className="flex gap-2">
                            <Input type="date" value={editSessionStart} onChange={(e) => setEditSessionStart(e.target.value)} />
                            <Input type="date" value={editSessionEnd} onChange={(e) => setEditSessionEnd(e.target.value)} />
                          </div>
                        </td>
                        <td className={tdClass}>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={editSessionCurrent} onChange={(e) => setEditSessionCurrent(e.target.checked)} />
                            Current
                          </label>
                        </td>
                        <td className={cn(tdClass, 'text-right')}>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              disabled={updateSession.isPending}
                              onClick={() =>
                                updateSession.mutate({
                                  id: s.id,
                                  body: {
                                    name: editSessionName,
                                    startDate: new Date(editSessionStart).toISOString(),
                                    endDate: new Date(editSessionEnd).toISOString(),
                                    isCurrent: editSessionCurrent,
                                  },
                                })
                              }
                            >
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditSessionId(null)}>
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
                          {s.isCurrent ? (
                            <StatusBadge label="Current" code="active" />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className={cn(tdClass, 'text-right')}>
                          <RowActionsMenu
                            items={[
                              {
                                label: 'Edit',
                                onClick: () => {
                                  setEditSessionId(s.id);
                                  setEditSessionName(s.name);
                                  setEditSessionStart(s.startDate.slice(0, 10));
                                  setEditSessionEnd(s.endDate.slice(0, 10));
                                  setEditSessionCurrent(s.isCurrent);
                                },
                              },
                            ]}
                          />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ContentPanel>
      )}

      {tab === 'subjects' && (
        <ContentPanel title={`Subjects (${subjects?.data.length ?? 0})`}>
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
                {subjectsLoading &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={3} className={tdClass}>
                        <div className="h-4 w-full animate-pulse rounded bg-[var(--neutral-50)]" />
                      </td>
                    </tr>
                  ))}
                {!subjectsLoading && subjects?.data.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--neutral-50)]/50">
                    {editSubjectId === s.id ? (
                      <>
                        <td className={tdClass}>
                          <Input value={editSubjectName} onChange={(e) => setEditSubjectName(e.target.value)} />
                        </td>
                        <td className={tdClass}>
                          <Input value={editSubjectCode} onChange={(e) => setEditSubjectCode(e.target.value)} />
                        </td>
                        <td className={cn(tdClass, 'text-right')}>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              disabled={updateSubject.isPending}
                              onClick={() =>
                                updateSubject.mutate({
                                  id: s.id,
                                  body: {
                                    name: editSubjectName,
                                    ...(editSubjectCode ? { code: editSubjectCode } : {}),
                                  },
                                })
                              }
                            >
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditSubjectId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={tdClass}>{s.name}</td>
                        <td className={tdClass}>{s.code ?? '—'}</td>
                        <td className={cn(tdClass, 'text-right')}>
                          <RowActionsMenu
                            items={[
                              {
                                label: 'Edit',
                                onClick: () => {
                                  setEditSubjectId(s.id);
                                  setEditSubjectName(s.name);
                                  setEditSubjectCode(s.code ?? '');
                                },
                              },
                            ]}
                          />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ContentPanel>
      )}

      {tab === 'assignments' && (
        <ContentPanel title="Assign subjects to batch">
          <div className="space-y-4 px-5 pb-5 pt-4">
            <SelectDropdown
              aria-label="Select batch"
              placeholder="Select batch"
              value={assignBatchId}
              onValueChange={setAssignBatchId}
              options={batchOptions}
            />
            {assignBatchId && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[320px] border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className={thClass}>Subject</th>
                        <th className={cn(thClass, 'w-24')}>Assigned</th>
                      </tr>
                    </thead>
                    <tbody className="[&>tr:last-child>td]:border-b-0">
                      {subjects?.data.map((s) => (
                        <tr key={s.id} className="hover:bg-[var(--neutral-50)]/50">
                          <td className={tdClass}>{s.name}</td>
                          <td className={tdClass}>
                            <input
                              type="checkbox"
                              checked={selectedSubjectIds.includes(s.id)}
                              onChange={(e) => {
                                setSelectedSubjectIds((prev) =>
                                  e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                                );
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button onClick={() => saveBatchSubjects.mutate()} disabled={saveBatchSubjects.isPending}>
                  Save assignments
                </Button>
              </>
            )}
          </div>
        </ContentPanel>
      )}

      <Dialog open={createProgramOpen} onOpenChange={setCreateProgramOpen}>
        <DialogContent>
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <div>
              <DialogTitle>Add program</DialogTitle>
              <DialogDescription>Create a new academic program for this branch.</DialogDescription>
            </div>
            <button type="button" onClick={() => setCreateProgramOpen(false)} className="text-[var(--text-sub-500)]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form
            className="space-y-4 px-5"
            onSubmit={(e) => {
              e.preventDefault();
              createProgram.mutate({
                branchId: effectiveBranchId,
                name: programName,
                ...(programCode ? { code: programCode } : {}),
              });
            }}
          >
            <Input placeholder="Program name" value={programName} onChange={(e) => setProgramName(e.target.value)} required />
            <Input placeholder="Code (optional)" value={programCode} onChange={(e) => setProgramCode(e.target.value)} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateProgramOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createProgram.isPending || !effectiveBranchId}>
                Add program
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={createBatchOpen} onOpenChange={setCreateBatchOpen}>
        <DialogContent>
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <div>
              <DialogTitle>Add batch</DialogTitle>
              <DialogDescription>Create a batch under a program.</DialogDescription>
            </div>
            <button type="button" onClick={() => setCreateBatchOpen(false)} className="text-[var(--text-sub-500)]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form
            className="space-y-4 px-5"
            onSubmit={(e) => {
              e.preventDefault();
              createBatch.mutate({
                branchId: effectiveBranchId,
                programId: batchProgramId,
                name: batchName,
              });
            }}
          >
            <SelectDropdown
              aria-label="Program"
              placeholder="Select program"
              value={batchProgramId}
              onValueChange={setBatchProgramId}
              options={[{ value: '', label: 'Select program' }, ...programOptions]}
              fullWidth
            />
            <Input placeholder="Batch name" value={batchName} onChange={(e) => setBatchName(e.target.value)} required />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateBatchOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createBatch.isPending || !batchProgramId}>
                Add batch
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={createSubjectOpen} onOpenChange={setCreateSubjectOpen}>
        <DialogContent>
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <div>
              <DialogTitle>Add subject</DialogTitle>
              <DialogDescription>Create a subject available for batch assignments.</DialogDescription>
            </div>
            <button type="button" onClick={() => setCreateSubjectOpen(false)} className="text-[var(--text-sub-500)]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form
            className="space-y-4 px-5"
            onSubmit={(e) => {
              e.preventDefault();
              createSubject.mutate({
                name: subjectName,
                ...(subjectCode ? { code: subjectCode } : {}),
              });
            }}
          >
            <Input placeholder="Subject name" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} required />
            <Input placeholder="Code (optional)" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateSubjectOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createSubject.isPending}>
                Add subject
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={createSessionOpen} onOpenChange={setCreateSessionOpen}>
        <DialogContent>
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <div>
              <DialogTitle>Add academic session</DialogTitle>
              <DialogDescription>Define a new academic year or term.</DialogDescription>
            </div>
            <button type="button" onClick={() => setCreateSessionOpen(false)} className="text-[var(--text-sub-500)]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form
            className="space-y-4 px-5"
            onSubmit={(e) => {
              e.preventDefault();
              createSession.mutate({
                name: sessionName,
                startDate: new Date(sessionStart).toISOString(),
                endDate: new Date(sessionEnd).toISOString(),
                isCurrent: true,
              });
            }}
          >
            <Input placeholder="Name (e.g. 2026)" value={sessionName} onChange={(e) => setSessionName(e.target.value)} required />
            <Input type="date" value={sessionStart} onChange={(e) => setSessionStart(e.target.value)} required />
            <Input type="date" value={sessionEnd} onChange={(e) => setSessionEnd(e.target.value)} required />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateSessionOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createSession.isPending}>
                Add session
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
