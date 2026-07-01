'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LinkButton } from '@/components/ui/link-button';
import { PageHeader } from '@/components/layout/page-header';
import { ListRow } from '@/components/layout/list-row';
import { ListLoadingSkeleton } from '@/components/layout/list-loading-skeleton';

interface Assessment {
  id: string;
  name: string;
  totalMarks: number;
  type?: { name: string };
}

interface AssessmentType {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface AssessmentSeries {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export default function AssessmentsPage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState('');
  const [seriesId, setSeriesId] = useState('');
  const [totalMarks, setTotalMarks] = useState('100');
  const [branchId, setBranchId] = useState(user?.branchId ?? '');
  const [showSeries, setShowSeries] = useState(false);
  const [showTypes, setShowTypes] = useState(false);
  const [seriesName, setSeriesName] = useState('');
  const [seriesCode, setSeriesCode] = useState('');
  const [typeName, setTypeName] = useState('');
  const [typeCode, setTypeCode] = useState('');

  const [editSeriesId, setEditSeriesId] = useState<string | null>(null);
  const [editSeriesName, setEditSeriesName] = useState('');
  const [editSeriesCode, setEditSeriesCode] = useState('');
  const [editSeriesActive, setEditSeriesActive] = useState(true);

  const [editTypeId, setEditTypeId] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState('');
  const [editTypeCode, setEditTypeCode] = useState('');
  const [editTypeActive, setEditTypeActive] = useState(true);

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => apiClient<{ data: { id: string; name: string }[] }>('/branches', { token }),
    enabled: !!token,
  });

  const effectiveBranchId = branchId || user?.branchId || branches?.data[0]?.id || '';

  const { data: assessments, isLoading } = useQuery({
    queryKey: ['assessments', effectiveBranchId],
    queryFn: () =>
      apiClient<{ data: Assessment[] }>(
        `/assessments${effectiveBranchId ? `?branchId=${effectiveBranchId}` : ''}`,
        { token },
      ),
    enabled: !!token,
  });

  const { data: types } = useQuery({
    queryKey: ['assessment-types', showTypes],
    queryFn: () =>
      apiClient<{ data: AssessmentType[] }>(
        `/assessment-types${showTypes ? '?all=true' : ''}`,
        { token },
      ),
    enabled: !!token && (showForm || showTypes),
  });

  const { data: seriesList } = useQuery({
    queryKey: ['assessment-series'],
    queryFn: () => apiClient<{ data: AssessmentSeries[] }>('/assessment-series', { token }),
    enabled: !!token,
  });

  const createSeriesMutation = useMutation({
    mutationFn: (body: { name: string; code: string }) =>
      apiClient('/assessment-series', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Series created');
      queryClient.invalidateQueries({ queryKey: ['assessment-series'] });
      setSeriesName('');
      setSeriesCode('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateSeriesMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiClient(`/assessment-series/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Series updated');
      queryClient.invalidateQueries({ queryKey: ['assessment-series'] });
      setEditSeriesId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createTypeMutation = useMutation({
    mutationFn: (body: { name: string; code: string }) =>
      apiClient('/assessment-types', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Type created');
      queryClient.invalidateQueries({ queryKey: ['assessment-types'] });
      setTypeName('');
      setTypeCode('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateTypeMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiClient(`/assessment-types/${id}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Type updated');
      queryClient.invalidateQueries({ queryKey: ['assessment-types'] });
      setEditTypeId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient('/assessments', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Assessment created');
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      setShowForm(false);
      setName('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessments"
        description="Tests, exams, and marks entry"
        actions={
          <>
            <Button onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : 'New assessment'}
            </Button>
            <Button variant="outline" onClick={() => setShowSeries(!showSeries)}>
              {showSeries ? 'Hide series' : 'Manage series'}
            </Button>
            <Button variant="outline" onClick={() => setShowTypes(!showTypes)}>
              {showTypes ? 'Hide types' : 'Manage types'}
            </Button>
          </>
        }
      />

      {showSeries && (
        <Card>
          <CardHeader>
            <CardTitle>Assessment series</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                createSeriesMutation.mutate({ name: seriesName, code: seriesCode });
              }}
            >
              <Input placeholder="Name (FLP-5)" value={seriesName} onChange={(e) => setSeriesName(e.target.value)} required />
              <Input placeholder="Code (flp_5)" value={seriesCode} onChange={(e) => setSeriesCode(e.target.value)} required />
              <Button type="submit" disabled={createSeriesMutation.isPending}>
                Add series
              </Button>
            </form>
            <div className="divide-y divide-border">
              {seriesList?.data.map((s) => (
                <div key={s.id} className="py-2">
                  {editSeriesId === s.id ? (
                    <div className="flex flex-wrap gap-2">
                      <Input value={editSeriesName} onChange={(e) => setEditSeriesName(e.target.value)} placeholder="Name" />
                      <Input value={editSeriesCode} onChange={(e) => setEditSeriesCode(e.target.value)} placeholder="Code" />
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={editSeriesActive} onChange={(e) => setEditSeriesActive(e.target.checked)} />
                        Active
                      </label>
                      <Button
                        size="sm"
                        disabled={updateSeriesMutation.isPending}
                        onClick={() =>
                          updateSeriesMutation.mutate({
                            id: s.id,
                            body: { name: editSeriesName, code: editSeriesCode, isActive: editSeriesActive },
                          })
                        }
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditSeriesId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <ListRow
                      actions={
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${s.isActive ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {s.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditSeriesId(s.id);
                              setEditSeriesName(s.name);
                              setEditSeriesCode(s.code);
                              setEditSeriesActive(s.isActive);
                            }}
                          >
                            Edit
                          </Button>
                        </div>
                      }
                    >
                      <p className="text-sm font-medium">
                        {s.name} <span className="text-muted-foreground">({s.code})</span>
                      </p>
                    </ListRow>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showTypes && (
        <Card>
          <CardHeader>
            <CardTitle>Assessment types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                createTypeMutation.mutate({ name: typeName, code: typeCode });
              }}
            >
              <Input placeholder="Name (Midterm)" value={typeName} onChange={(e) => setTypeName(e.target.value)} required />
              <Input placeholder="Code (midterm)" value={typeCode} onChange={(e) => setTypeCode(e.target.value)} required />
              <Button type="submit" disabled={createTypeMutation.isPending}>
                Add type
              </Button>
            </form>
            <div className="divide-y divide-border">
              {types?.data.map((t) => (
                <div key={t.id} className="py-2">
                  {editTypeId === t.id ? (
                    <div className="flex flex-wrap gap-2">
                      <Input value={editTypeName} onChange={(e) => setEditTypeName(e.target.value)} placeholder="Name" />
                      <Input value={editTypeCode} onChange={(e) => setEditTypeCode(e.target.value)} placeholder="Code" />
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={editTypeActive} onChange={(e) => setEditTypeActive(e.target.checked)} />
                        Active
                      </label>
                      <Button
                        size="sm"
                        disabled={updateTypeMutation.isPending}
                        onClick={() =>
                          updateTypeMutation.mutate({
                            id: t.id,
                            body: { name: editTypeName, code: editTypeCode, isActive: editTypeActive },
                          })
                        }
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditTypeId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <ListRow
                      actions={
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${t.isActive ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {t.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditTypeId(t.id);
                              setEditTypeName(t.name);
                              setEditTypeCode(t.code);
                              setEditTypeActive(t.isActive);
                            }}
                          >
                            Edit
                          </Button>
                        </div>
                      }
                    >
                      <p className="text-sm font-medium">
                        {t.name} <span className="text-muted-foreground">({t.code})</span>
                      </p>
                    </ListRow>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({
                  branchId: effectiveBranchId,
                  name,
                  typeId,
                  totalMarks: Number(totalMarks),
                  ...(seriesId ? { seriesId } : {}),
                });
              }}
            >
              {!user?.branchId && (
                <select
                  className="flex h-10 rounded-md border border-border bg-background px-3 text-sm sm:col-span-2"
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
              <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <select
                className="flex h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                required
              >
                <option value="">Type</option>
                {types?.data.filter((t) => t.isActive).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <select
                className="flex h-10 rounded-md border border-border bg-background px-3 text-sm"
                value={seriesId}
                onChange={(e) => setSeriesId(e.target.value)}
              >
                <option value="">Series (optional)</option>
                {seriesList?.data.filter((s) => s.isActive).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                placeholder="Total marks"
                value={totalMarks}
                onChange={(e) => setTotalMarks(e.target.value)}
                required
              />
              <Button type="submit" disabled={createMutation.isPending || !effectiveBranchId}>
                Create
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All assessments ({assessments?.data.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <ListLoadingSkeleton />}
          <div className="divide-y divide-border">
            {assessments?.data.map((a) => (
              <ListRow
                key={a.id}
                actions={
                  <LinkButton href={`/dashboard/assessments/${a.id}/marks`}>Enter marks</LinkButton>
                }
              >
                <p className="font-medium">{a.name}</p>
                <p className="text-sm text-muted-foreground">
                  {a.type?.name ?? '—'} · {a.totalMarks} marks
                </p>
              </ListRow>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
