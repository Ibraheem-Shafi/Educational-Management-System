'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { PageTabs } from '@/components/layout/page-tabs';
import { ListRow } from '@/components/layout/list-row';
import { filterSelectClass } from '@/components/layout/filter-bar';
import { ListLoadingSkeleton } from '@/components/layout/list-loading-skeleton';

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

export default function AcademicPage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'programs' | 'batches' | 'subjects' | 'sessions' | 'assignments'>('programs');
  const [branchId, setBranchId] = useState(user?.branchId ?? '');
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
    queryKey: ['branches'],
    queryFn: () => apiClient<{ data: Branch[] }>('/branches', { token }),
    enabled: !!token,
  });

  const effectiveBranchId = branchId || user?.branchId || branches?.data[0]?.id || '';

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

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['academic-sessions'],
    queryFn: () => apiClient<{ data: Session[] }>('/academic-sessions', { token }),
    enabled: !!token && tab === 'sessions',
  });

  const createProgram = useMutation({
    mutationFn: (body: { branchId: string; name: string; code?: string }) =>
      apiClient('/programs', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Program created');
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      setProgramName('');
      setProgramCode('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createBatch = useMutation({
    mutationFn: (body: { branchId: string; programId: string; name: string }) =>
      apiClient('/batches', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Batch created');
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setBatchName('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createSession = useMutation({
    mutationFn: (body: { name: string; startDate: string; endDate: string; isCurrent?: boolean }) =>
      apiClient('/academic-sessions', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Session created');
      queryClient.invalidateQueries({ queryKey: ['academic-sessions'] });
      setSessionName('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createSubject = useMutation({
    mutationFn: (body: { name: string; code?: string }) =>
      apiClient('/subjects', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Subject created');
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setSubjectName('');
      setSubjectCode('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateProgram = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiClient(`/programs/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Program updated');
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      setEditProgramId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateBatch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiClient(`/batches/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Batch updated');
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setEditBatchId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateSubject = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiClient(`/subjects/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Subject updated');
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setEditSubjectId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateSession = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiClient(`/academic-sessions/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Session updated');
      queryClient.invalidateQueries({ queryKey: ['academic-sessions'] });
      setEditSessionId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Academic" description="Programs, batches, and subjects" />

      <PageTabs
        tabs={[
          { id: 'programs', label: 'Programs' },
          { id: 'batches', label: 'Batches' },
          { id: 'subjects', label: 'Subjects' },
          { id: 'sessions', label: 'Sessions' },
          { id: 'assignments', label: 'Batch subjects' },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as typeof tab)}
      />

      {tab === 'programs' && (
        <>
          {!user?.branchId && (
            <select
              className={filterSelectClass}
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              {branches?.data.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Add program</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-wrap gap-3"
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
                <Input placeholder="Code" value={programCode} onChange={(e) => setProgramCode(e.target.value)} />
                <Button type="submit" disabled={createProgram.isPending || !effectiveBranchId}>
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Programs ({programs?.data.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {programsLoading && <ListLoadingSkeleton />}
              <div className="divide-y divide-border">
                {programs?.data.map((p) => (
                  <div key={p.id} className="py-3">
                    {editProgramId === p.id ? (
                      <div className="flex flex-wrap gap-2">
                        <Input value={editProgramName} onChange={(e) => setEditProgramName(e.target.value)} placeholder="Name" />
                        <Input value={editProgramCode} onChange={(e) => setEditProgramCode(e.target.value)} placeholder="Code" />
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
                    ) : (
                      <ListRow
                        actions={
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditProgramId(p.id);
                              setEditProgramName(p.name);
                              setEditProgramCode(p.code ?? '');
                            }}
                          >
                            Edit
                          </Button>
                        }
                      >
                        <p className="font-medium">{p.name}</p>
                        <p className="text-sm text-muted-foreground">{p.code ?? '—'}</p>
                      </ListRow>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'batches' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Add batch</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-wrap gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  createBatch.mutate({
                    branchId: effectiveBranchId,
                    programId: batchProgramId,
                    name: batchName,
                  });
                }}
              >
                <select
                  className={filterSelectClass}
                  value={batchProgramId}
                  onChange={(e) => setBatchProgramId(e.target.value)}
                  required
                >
                  <option value="">Program</option>
                  {programs?.data.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Input placeholder="Batch name" value={batchName} onChange={(e) => setBatchName(e.target.value)} required />
                <Button type="submit" disabled={createBatch.isPending}>
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Batches ({batches?.data.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {batchesLoading && <ListLoadingSkeleton />}
              <div className="divide-y divide-border">
                {batches?.data.map((b) => (
                  <div key={b.id} className="py-3">
                    {editBatchId === b.id ? (
                      <div className="flex flex-wrap gap-2">
                        <Input value={editBatchName} onChange={(e) => setEditBatchName(e.target.value)} placeholder="Name" />
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
                    ) : (
                      <ListRow
                        actions={
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditBatchId(b.id);
                              setEditBatchName(b.name);
                            }}
                          >
                            Edit
                          </Button>
                        }
                      >
                        <p className="font-medium">{b.name}</p>
                        <p className="text-sm text-muted-foreground">{b.program?.name ?? '—'}</p>
                      </ListRow>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'sessions' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Add academic session</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-wrap gap-3"
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
                <Button type="submit" disabled={createSession.isPending}>
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Sessions ({sessions?.data.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {sessionsLoading && <ListLoadingSkeleton />}
              <div className="divide-y divide-border">
                {sessions?.data.map((s) => (
                  <div key={s.id} className="py-3">
                    {editSessionId === s.id ? (
                      <div className="flex flex-wrap gap-2">
                        <Input value={editSessionName} onChange={(e) => setEditSessionName(e.target.value)} placeholder="Name" />
                        <Input type="date" value={editSessionStart} onChange={(e) => setEditSessionStart(e.target.value)} />
                        <Input type="date" value={editSessionEnd} onChange={(e) => setEditSessionEnd(e.target.value)} />
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={editSessionCurrent} onChange={(e) => setEditSessionCurrent(e.target.checked)} />
                          Current
                        </label>
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
                    ) : (
                      <ListRow
                        actions={
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditSessionId(s.id);
                              setEditSessionName(s.name);
                              setEditSessionStart(s.startDate.slice(0, 10));
                              setEditSessionEnd(s.endDate.slice(0, 10));
                              setEditSessionCurrent(s.isCurrent);
                            }}
                          >
                            Edit
                          </Button>
                        }
                      >
                        <p className="font-medium">
                          {s.name} {s.isCurrent ? '(current)' : ''}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {s.startDate.slice(0, 10)} – {s.endDate.slice(0, 10)}
                        </p>
                      </ListRow>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'subjects' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Add subject</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-wrap gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  createSubject.mutate({
                    name: subjectName,
                    ...(subjectCode ? { code: subjectCode } : {}),
                  });
                }}
              >
                <Input placeholder="Subject name" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} required />
                <Input placeholder="Code" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} />
                <Button type="submit" disabled={createSubject.isPending}>
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subjects ({subjects?.data.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {subjectsLoading && <ListLoadingSkeleton />}
              <div className="divide-y divide-border">
                {subjects?.data.map((s) => (
                  <div key={s.id} className="py-3">
                    {editSubjectId === s.id ? (
                      <div className="flex flex-wrap gap-2">
                        <Input value={editSubjectName} onChange={(e) => setEditSubjectName(e.target.value)} placeholder="Name" />
                        <Input value={editSubjectCode} onChange={(e) => setEditSubjectCode(e.target.value)} placeholder="Code" />
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
                    ) : (
                      <ListRow
                        actions={
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditSubjectId(s.id);
                              setEditSubjectName(s.name);
                              setEditSubjectCode(s.code ?? '');
                            }}
                          >
                            Edit
                          </Button>
                        }
                      >
                        <p className="font-medium">{s.name}</p>
                        <p className="text-sm text-muted-foreground">{s.code ?? '—'}</p>
                      </ListRow>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'assignments' && (
        <Card>
          <CardHeader>
            <CardTitle>Assign subjects to batch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              className={filterSelectClass}
              value={assignBatchId}
              onChange={(e) => setAssignBatchId(e.target.value)}
            >
              <option value="">Select batch</option>
              {batches?.data.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {assignBatchId && (
              <div className="space-y-2">
                {subjects?.data.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedSubjectIds.includes(s.id)}
                      onChange={(e) => {
                        setSelectedSubjectIds((prev) =>
                          e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                        );
                      }}
                    />
                    {s.name}
                  </label>
                ))}
                <Button onClick={() => saveBatchSubjects.mutate()} disabled={saveBatchSubjects.isPending}>
                  Save assignments
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
