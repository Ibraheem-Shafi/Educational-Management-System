'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchId } from '@/hooks/use-branches';
import type { AssessmentsStatsResponse } from '@eims/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { SearchInput } from '@/components/layout/search-input';
import { FilterBar } from '@/components/layout/filter-bar';
import { ContentPanel } from '@/components/layout/content-panel';
import { ListRow } from '@/components/layout/list-row';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { CreateAssessmentDialog } from '@/components/features/assessments/create-assessment-dialog';
import {
  dataTableClass,
  dataTableRowHoverClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

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

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

export default function AssessmentsPage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
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

  const { effectiveBranchId } = useEffectiveBranchId(token, user?.branchId);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.assessmentsStats,
    queryFn: () => apiClient<AssessmentsStatsResponse>('/assessments/stats', { token }),
    enabled: !!token,
  });

  const { data: assessments, isLoading, error } = useQuery({
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
    enabled: !!token && (showTypes || createOpen),
  });

  const { data: seriesList } = useQuery({
    queryKey: ['assessment-series'],
    queryFn: () => apiClient<{ data: AssessmentSeries[] }>('/assessment-series', { token }),
    enabled: !!token && showSeries,
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

  const filteredAssessments = (assessments?.data ?? []).filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      (a.type?.name ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={ClipboardList}
        title="Assessments"
        description="Tests, exams, and marks entry"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setShowSeries(!showSeries)}>
              {showSeries ? 'Hide series' : 'Manage series'}
            </Button>
            <Button variant="outline" onClick={() => setShowTypes(!showTypes)}>
              {showTypes ? 'Hide types' : 'Manage types'}
            </Button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className={pageHeaderActionClassName}
            >
              <PageHeaderActionIcon />
              New assessment
            </button>
          </div>
        }
      />

      <CreateAssessmentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        branchId={effectiveBranchId}
      />

      <MainStatsSection
        isLoading={statsLoading}
        stats={[
          {
            label: 'Active assessments',
            value: formatCount(stats?.activeAssessments.total ?? 0),
            changePercent: stats?.activeAssessments.changePercent,
          },
          {
            label: 'Completed',
            value: formatCount(stats?.completedAssessments.total ?? 0),
            changePercent: stats?.completedAssessments.changePercent,
          },
          {
            label: 'Average score',
            value: `${stats?.averageScore.total ?? 0}%`,
            changePercent: stats?.averageScore.changePercent,
          },
          {
            label: 'Pending marks',
            value: formatCount(stats?.pendingMarks.total ?? 0),
            changePercent: stats?.pendingMarks.changePercent,
          },
        ]}
      />

      {showSeries && (
        <ContentPanel title="Assessment series">
          <div className="space-y-4 p-5">
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
            <div className="divide-y divide-[var(--stroke-soft-200,#E2E4E9)]">
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
                          <span className={`text-xs ${s.isActive ? 'text-green-600' : 'text-[var(--text-sub-500)]'}`}>
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
                        {s.name} <span className="text-[var(--text-sub-500)]">({s.code})</span>
                      </p>
                    </ListRow>
                  )}
                </div>
              ))}
            </div>
          </div>
        </ContentPanel>
      )}

      {showTypes && (
        <ContentPanel title="Assessment types">
          <div className="space-y-4 p-5">
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
            <div className="divide-y divide-[var(--stroke-soft-200,#E2E4E9)]">
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
                          <span className={`text-xs ${t.isActive ? 'text-green-600' : 'text-[var(--text-sub-500)]'}`}>
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
                        {t.name} <span className="text-[var(--text-sub-500)]">({t.code})</span>
                      </p>
                    </ListRow>
                  )}
                </div>
              ))}
            </div>
          </div>
        </ContentPanel>
      )}

      <FilterBar className="items-center">
        <SearchInput value={search} onValueChange={handleSearchChange} />
        {search && (
          <Button variant="ghost" onClick={() => setSearch('')}>
            Clear filters
          </Button>
        )}
      </FilterBar>

      <div className="bg-white">
        <div className={dataTableWrapperClass}>
          <table className={dataTableClass}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Name</th>
                <th className={dataTableThClass}>Type</th>
                <th className={dataTableThClass}>Total marks</th>
                <th className={cn(dataTableThClass, 'w-12')} />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {isLoading && <DataTableSkeletonRows columns={4} rows={8} />}

              {error && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-red-600">
                    Failed to load assessments
                  </td>
                </tr>
              )}

              {!isLoading && !error && filteredAssessments.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]"
                  >
                    No assessments found
                  </td>
                </tr>
              )}

              {!isLoading &&
                !error &&
                filteredAssessments.map((assessment) => (
                  <tr key={assessment.id} className={cn('transition-colors', dataTableRowHoverClass)}>
                    <td className={dataTableTdClass}>{assessment.name}</td>
                    <td className={dataTableTdClass}>{assessment.type?.name ?? '—'}</td>
                    <td className={dataTableTdClass}>{assessment.totalMarks}</td>
                    <td className={cn(dataTableTdClass, 'text-right')}>
                      <RowActionsMenu
                        items={[
                          {
                            label: 'Enter marks',
                            href: `/dashboard/assessments/${assessment.id}/marks`,
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
