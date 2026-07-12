'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import type { AcademicStatsResponse, ProgramListItem } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { MainStatsSection, type MainStatItem } from '@/components/layout/main-stats-section';
import { Tabs } from '@/components/ui/tabs';
import { ContentPanel } from '@/components/layout/content-panel';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { StatusBadge } from '@/components/layout/status-badge';
import { CreateBatchDialog } from '@/components/features/academic/create-batch-dialog';
import { EditBatchDialog } from '@/components/features/academic/edit-batch-dialog';
import { CreateSubjectDialog } from '@/components/features/academic/create-subject-dialog';
import { EditSubjectDialog } from '@/components/features/academic/edit-subject-dialog';
import { CreateSessionDialog } from '@/components/features/academic/create-session-dialog';
import { cn } from '@/lib/utils';

const thClass =
  'h-9 border-0 bg-[#F8F8F8] px-4 text-left text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] first:rounded-l-lg last:rounded-r-lg';
const tdClass =
  'border-0 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-3 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900,#0A0D14)]';

type AcademicTab = 'programs' | 'batches' | 'subjects' | 'sessions';

interface Branch {
  id: string;
  name: string;
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
  };

  return order[tab].map((i) => all[i]);
}

export default function AcademicPage() {
  const router = useRouter();
  const { session, user } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.ACADEMIC_MANAGE);
  const [tab, setTab] = useState<AcademicTab>('programs');
  const [branchId, setBranchId] = useState(user?.branchId ?? '');

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
    queryKey: queryKeys.programs(effectiveBranchId),
    queryFn: () =>
      apiClient<{ data: ProgramListItem[] }>(`/programs?branchId=${effectiveBranchId}`, { token }),
    enabled: !!token && !!effectiveBranchId && (tab === 'programs' || tab === 'batches'),
  });

  const { data: subjects, isLoading: subjectsLoading } = useQuery({
    queryKey: queryKeys.subjects,
    queryFn: () => apiClient<{ data: Subject[] }>('/subjects', { token }),
    enabled: !!token && tab === 'subjects',
  });

  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ['batches', effectiveBranchId],
    queryFn: () =>
      apiClient<{ data: Batch[] }>(`/batches?branchId=${effectiveBranchId}`, { token }),
    enabled: !!token && !!effectiveBranchId && tab === 'batches',
  });

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

  const invalidateAcademic = () => {
    queryClient.invalidateQueries({ queryKey: ['programs'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.programs() });
    queryClient.invalidateQueries({ queryKey: ['batches'] });
    queryClient.invalidateQueries({ queryKey: ['subjects'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.subjects });
    queryClient.invalidateQueries({ queryKey: ['academic-sessions'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.academicStats() });
  };

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
        onValueChange={(id) => setTab(id as AcademicTab)}
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
                {programsLoading &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={4} className={tdClass}>
                        <div className="h-4 w-full animate-pulse rounded bg-[var(--neutral-50)]" />
                      </td>
                    </tr>
                  ))}
                {!programsLoading &&
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
                {!batchesLoading &&
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
                {!sessionsLoading &&
                  sessions?.data.map((s) => (
                    <tr key={s.id} className="hover:bg-[var(--neutral-50)]/50">
                      {editSessionId === s.id ? (
                        <>
                          <td className={tdClass}>
                            <Input
                              value={editSessionName}
                              onChange={(e) => setEditSessionName(e.target.value)}
                            />
                          </td>
                          <td className={tdClass}>
                            <div className="flex gap-2">
                              <Input
                                type="date"
                                value={editSessionStart}
                                onChange={(e) => setEditSessionStart(e.target.value)}
                              />
                              <Input
                                type="date"
                                value={editSessionEnd}
                                onChange={(e) => setEditSessionEnd(e.target.value)}
                              />
                            </div>
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
                            {s.isCurrent ? <StatusBadge label="Current" code="active" /> : '—'}
                          </td>
                          <td className={cn(tdClass, 'text-right')}>
                            {canManage ? (
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
                            ) : null}
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
                {!subjectsLoading &&
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
                  ))}
              </tbody>
            </table>
          </div>
        </ContentPanel>
      )}

      <CreateBatchDialog
        open={createBatchOpen}
        onOpenChange={setCreateBatchOpen}
        branchId={effectiveBranchId}
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
