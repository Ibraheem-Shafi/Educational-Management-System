'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS, ASSESSMENT_STATUSES } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { withBranchScope } from '@/lib/branch-scope';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import type { AssessmentsStatsResponse, PaginatedResponse } from '@eims/types';
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FilterBar } from '@/components/layout/filter-bar';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { CreateAssessmentDialog } from '@/components/features/assessments/create-assessment-dialog';
import {
  AssessmentTaxonomyDialog,
  type AssessmentTaxonomyKind,
} from '@/components/features/assessments/assessment-taxonomy-dialog';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { queryKeys } from '@/lib/query-keys';
import { StatusBadge, statusRowClass } from '@/components/layout/status-badge';
import { cn } from '@/lib/utils';

type AssessmentsTab = 'assessments' | 'series' | 'types';

const ASSESSMENT_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...ASSESSMENT_STATUSES.map((status) => ({
    value: status,
    label: status === 'in_review' ? 'In review' : status.charAt(0).toUpperCase() + status.slice(1),
  })),
];

interface Assessment {
  id: string;
  name: string;
  totalMarks: number;
  typeId: string;
  seriesId: string | null;
  status: string;
  answerKey: string | null;
  reviewNotes: string | null;
  type?: { name: string };
}

function assessmentStatusLabel(status: string): string {
  switch (status) {
    case 'in_review':
      return 'In review';
    case 'published':
      return 'Published';
    default:
      return 'Draft';
  }
}

function assessmentStatusCode(status: string): string {
  switch (status) {
    case 'published':
      return 'active';
    case 'in_review':
      return 'pending';
    default:
      return 'draft';
  }
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

const editIcon = (
  <Pencil className="h-4 w-4 shrink-0 text-[var(--text-soft-400,#868C98)]" strokeWidth={1.5} />
);

export default function AssessmentsPage() {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canEnterMarks = can(PERMISSIONS.ASSESSMENTS_MARKS_ENTER);
  const canPublish = can(PERMISSIONS.ASSESSMENTS_PUBLISH);
  const canManageAcademic = can(PERMISSIONS.ACADEMIC_MANAGE);

  const [tab, setTab] = useState<AssessmentsTab>('assessments');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [typeId, setTypeId] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [taxonomyDialog, setTaxonomyDialog] = useState<{
    kind: AssessmentTaxonomyKind;
    item: AssessmentSeries | AssessmentType | null;
  } | null>(null);

  const { effectiveScope, scopeKey, singleBranchId, appendToSearchParams } =
    useEffectiveBranchScope();

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const assessmentsQueryParams = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    appendToSearchParams(params);
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (typeId) params.set('typeId', typeId);
    return params.toString();
  }, [page, limit, search, status, typeId, appendToSearchParams]);

  const typesQueryParams = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      all: 'true',
    });
    if (search) params.set('search', search);
    return params.toString();
  }, [page, limit, search]);

  const seriesQueryParams = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (search) params.set('search', search);
    return params.toString();
  }, [page, limit, search]);

  const handleTabChange = (next: string) => {
    setTab(next as AssessmentsTab);
    setSearch('');
    setStatus('');
    setTypeId('');
    setPage(1);
  };

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: [...queryKeys.assessmentsStats, scopeKey],
    queryFn: () =>
      apiClient<AssessmentsStatsResponse>(withBranchScope('/assessments/stats', effectiveScope), {
        token,
      }),
    enabled: !!token,
  });

  const { data: typeOptions } = useQuery({
    queryKey: queryKeys.assessmentTypes({ all: true, limit: 100, options: true }),
    queryFn: () =>
      apiClient<PaginatedResponse<AssessmentType>>('/assessment-types?all=true&limit=100', {
        token,
      }),
    enabled: !!token && tab === 'assessments',
  });

  const { data: assessments, isLoading, error } = useQuery({
    queryKey: queryKeys.assessments({
      scopeKey,
      page,
      limit,
      search: search || undefined,
      status: status || undefined,
      typeId: typeId || undefined,
    }),
    queryFn: () =>
      apiClient<PaginatedResponse<Assessment>>(`/assessments?${assessmentsQueryParams}`, { token }),
    enabled: !!token && tab === 'assessments',
    placeholderData: (previous) => previous,
  });

  const { data: types, isLoading: typesLoading } = useQuery({
    queryKey: queryKeys.assessmentTypes({
      all: true,
      page,
      limit,
      search: search || undefined,
    }),
    queryFn: () =>
      apiClient<PaginatedResponse<AssessmentType>>(`/assessment-types?${typesQueryParams}`, {
        token,
      }),
    enabled: !!token && tab === 'types',
    placeholderData: (previous) => previous,
  });

  const { data: seriesList, isLoading: seriesLoading } = useQuery({
    queryKey: queryKeys.assessmentSeries({
      page,
      limit,
      search: search || undefined,
    }),
    queryFn: () =>
      apiClient<PaginatedResponse<AssessmentSeries>>(`/assessment-series?${seriesQueryParams}`, {
        token,
      }),
    enabled: !!token && tab === 'series',
    placeholderData: (previous) => previous,
  });

  const submitReviewMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/assessments/${id}/submit-review`, { method: 'POST', token }),
    onSuccess: () => {
      toast.success('Submitted for review');
      queryClient.invalidateQueries({ queryKey: queryKeys.assessments() });
      queryClient.invalidateQueries({ queryKey: queryKeys.assessmentsStats });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/assessments/${id}/publish`, { method: 'POST', token }),
    onSuccess: () => {
      toast.success('Assessment published');
      queryClient.invalidateQueries({ queryKey: queryKeys.assessments() });
      queryClient.invalidateQueries({ queryKey: queryKeys.assessmentsStats });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/assessments/${id}/unpublish`, { method: 'POST', token }),
    onSuccess: () => {
      toast.success('Assessment unpublished');
      queryClient.invalidateQueries({ queryKey: queryKeys.assessments() });
      queryClient.invalidateQueries({ queryKey: queryKeys.assessmentsStats });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createAction = (() => {
    if (tab === 'assessments' && canEnterMarks) {
      return { label: 'New assessment', onClick: () => setCreateOpen(true) };
    }
    if (tab === 'series' && canManageAcademic) {
      return {
        label: 'Add series',
        onClick: () => setTaxonomyDialog({ kind: 'series', item: null }),
      };
    }
    if (tab === 'types' && canManageAcademic) {
      return {
        label: 'Add type',
        onClick: () => setTaxonomyDialog({ kind: 'types', item: null }),
      };
    }
    return null;
  })();

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={ClipboardList}
        title="Assessments"
        description="Tests, exams, and marks entry"
        actions={
          createAction ? (
            <button
              type="button"
              onClick={createAction.onClick}
              className={pageHeaderActionClassName}
            >
              <PageHeaderActionIcon />
              {createAction.label}
            </button>
          ) : undefined
        }
      />

      <Tabs
        aria-label="Assessment sections"
        tabs={[
          { id: 'assessments', label: 'Assessments' },
          ...(canManageAcademic
            ? [
                { id: 'series', label: 'Series' },
                { id: 'types', label: 'Types' },
              ]
            : []),
        ]}
        value={tab}
        onValueChange={handleTabChange}
      />

      <CreateAssessmentDialog
        open={createOpen || Boolean(editingAssessment)}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditingAssessment(null);
          }
        }}
        branchId={singleBranchId ?? ''}
        assessment={editingAssessment}
      />

      <AssessmentTaxonomyDialog
        open={Boolean(taxonomyDialog)}
        onOpenChange={(open) => {
          if (!open) setTaxonomyDialog(null);
        }}
        kind={taxonomyDialog?.kind ?? 'series'}
        item={taxonomyDialog?.item}
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

      {tab === 'assessments' && (
        <>
          <FilterBar className="items-center">
            <SearchInput value={search} onValueChange={handleSearchChange} />
            <SelectDropdown
              aria-label="Filter by status"
              placeholder="All statuses"
              value={status}
              onValueChange={(next) => {
                setStatus(next);
                setPage(1);
              }}
              options={ASSESSMENT_STATUS_OPTIONS}
            />
            <SelectDropdown
              aria-label="Filter by type"
              placeholder="All types"
              value={typeId}
              onValueChange={(next) => {
                setTypeId(next);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All types' },
                ...(typeOptions?.data.map((t) => ({ value: t.id, label: t.name })) ?? []),
              ]}
            />
            {(search || status || typeId) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch('');
                  setStatus('');
                  setTypeId('');
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
            <PageBranchScopeControl />
          </FilterBar>

          <div className="bg-white">
            <div className={dataTableWrapperClass}>
              <table className={dataTableClass}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Name</th>
                    <th className={dataTableThClass}>Type</th>
                    <th className={dataTableThClass}>Status</th>
                    <th className={dataTableThClass}>Total marks</th>
                    <th className={cn(dataTableThClass, 'w-12')} />
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {isLoading ? <DataTableSkeletonRows columns={5} rows={limit} /> : null}

                  {error && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-red-600">
                        Failed to load assessments
                      </td>
                    </tr>
                  )}

                  {!isLoading && !error && (assessments?.data.length ?? 0) === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]"
                      >
                        No assessments found
                      </td>
                    </tr>
                  )}

                  {!isLoading &&
                    !error &&
                    assessments?.data.map((assessment) => (
                      <tr
                        key={assessment.id}
                        className={cn(
                          'transition-colors',
                          statusRowClass(
                            assessmentStatusCode(assessment.status),
                            assessmentStatusLabel(assessment.status),
                          ),
                        )}
                      >
                        <td className={dataTableTdClass}>{assessment.name}</td>
                        <td className={dataTableTdClass}>{assessment.type?.name ?? '—'}</td>
                        <td className={dataTableTdClass}>
                          <StatusBadge
                            label={assessmentStatusLabel(assessment.status)}
                            code={assessmentStatusCode(assessment.status)}
                          />
                        </td>
                        <td className={dataTableTdClass}>{assessment.totalMarks}</td>
                        <td className={cn(dataTableTdClass, 'text-right')}>
                          {canEnterMarks || canPublish ? (
                            <RowActionsMenu
                              items={[
                                ...(canEnterMarks && assessment.status !== 'published'
                                  ? [
                                      {
                                        label: 'Enter marks',
                                        href: `/dashboard/assessments/${assessment.id}/marks`,
                                      },
                                    ]
                                  : []),
                                ...(canEnterMarks && assessment.status !== 'published'
                                  ? [
                                      {
                                        label: 'Edit',
                                        onClick: () => setEditingAssessment(assessment),
                                      },
                                    ]
                                  : []),
                                ...(canEnterMarks && assessment.status === 'draft'
                                  ? [
                                      {
                                        label: 'Submit for review',
                                        onClick: () => submitReviewMutation.mutate(assessment.id),
                                      },
                                    ]
                                  : []),
                                ...(canPublish &&
                                (assessment.status === 'draft' ||
                                  assessment.status === 'in_review')
                                  ? [
                                      {
                                        label: 'Publish',
                                        onClick: () => publishMutation.mutate(assessment.id),
                                      },
                                    ]
                                  : []),
                                ...(canPublish && assessment.status === 'published'
                                  ? [
                                      {
                                        label: 'Unpublish',
                                        onClick: () => unpublishMutation.mutate(assessment.id),
                                      },
                                    ]
                                  : []),
                              ]}
                            />
                          ) : null}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {assessments?.meta && (
              <PaginationBar
                page={page}
                totalPages={assessments.meta.totalPages}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={(next) => {
                  setLimit(next);
                  setPage(1);
                }}
              />
            )}
          </div>
        </>
      )}

      {tab === 'series' && (
        <>
          <FilterBar className="items-center">
            <SearchInput value={search} onValueChange={handleSearchChange} />
            {search && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
              >
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
                  <th className={dataTableThClass}>Code</th>
                  <th className={dataTableThClass}>Status</th>
                  <th className={cn(dataTableThClass, 'w-12')} />
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {seriesLoading ? (
                  <DataTableSkeletonRows columns={4} rows={limit} />
                ) : (seriesList?.data.length ?? 0) === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]"
                    >
                      No series found
                    </td>
                  </tr>
                ) : (
                  seriesList?.data.map((s) => (
                    <tr
                      key={s.id}
                      className={cn(
                        'transition-colors',
                        statusRowClass(s.isActive ? 'active' : 'draft', s.isActive ? 'Active' : 'Inactive'),
                      )}
                    >
                      <td className={dataTableTdClass}>{s.name}</td>
                      <td className={dataTableTdClass}>{s.code}</td>
                      <td className={dataTableTdClass}>
                        <StatusBadge
                          label={s.isActive ? 'Active' : 'Inactive'}
                          code={s.isActive ? 'active' : 'draft'}
                        />
                      </td>
                      <td className={cn(dataTableTdClass, 'text-right')}>
                        {canManageAcademic ? (
                          <RowActionsMenu
                            items={[
                              {
                                label: 'Edit',
                                icon: editIcon,
                                onClick: () => setTaxonomyDialog({ kind: 'series', item: s }),
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

          {seriesList?.meta && (
            <PaginationBar
              page={page}
              totalPages={seriesList.meta.totalPages}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          )}
        </div>
        </>
      )}

      {tab === 'types' && (
        <>
          <FilterBar className="items-center">
            <SearchInput value={search} onValueChange={handleSearchChange} />
            {search && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
              >
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
                  <th className={dataTableThClass}>Code</th>
                  <th className={dataTableThClass}>Status</th>
                  <th className={cn(dataTableThClass, 'w-12')} />
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {typesLoading ? (
                  <DataTableSkeletonRows columns={4} rows={limit} />
                ) : (types?.data.length ?? 0) === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]"
                    >
                      No types found
                    </td>
                  </tr>
                ) : (
                  types?.data.map((t) => (
                    <tr
                      key={t.id}
                      className={cn(
                        'transition-colors',
                        statusRowClass(t.isActive ? 'active' : 'draft', t.isActive ? 'Active' : 'Inactive'),
                      )}
                    >
                      <td className={dataTableTdClass}>{t.name}</td>
                      <td className={dataTableTdClass}>{t.code}</td>
                      <td className={dataTableTdClass}>
                        <StatusBadge
                          label={t.isActive ? 'Active' : 'Inactive'}
                          code={t.isActive ? 'active' : 'draft'}
                        />
                      </td>
                      <td className={cn(dataTableTdClass, 'text-right')}>
                        {canManageAcademic ? (
                          <RowActionsMenu
                            items={[
                              {
                                label: 'Edit',
                                icon: editIcon,
                                onClick: () => setTaxonomyDialog({ kind: 'types', item: t }),
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

          {types?.meta && (
            <PaginationBar
              page={page}
              totalPages={types.meta.totalPages}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
            />
          )}
        </div>
        </>
      )}
    </div>
  );
}
