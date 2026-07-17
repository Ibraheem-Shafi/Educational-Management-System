'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookMarked } from 'lucide-react';
import type { LearningResourceResponse, LearningStatsResponse, PaginatedResponse } from '@eims/types';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchId } from '@/hooks/use-branches';
import { useBatches } from '@/hooks/use-batches';
import { queryKeys } from '@/lib/query-keys';
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { FilterBar } from '@/components/layout/filter-bar';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { StatusBadge } from '@/components/layout/status-badge';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { PaginationBar } from '@/components/layout/pagination-bar';
import {
  dataTableClass,
  dataTableRowHoverClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { cn } from '@/lib/utils';
import { CreateLearningDialog } from '@/components/features/learning/create-learning-dialog';

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'note', label: 'Notes' },
  { value: 'material', label: 'Materials' },
  { value: 'resource', label: 'Resources' },
  { value: 'homework', label: 'Homework' },
  { value: 'syllabus', label: 'Syllabus' },
  { value: 'online_class', label: 'Online class' },
];

interface Subject {
  id: string;
  name: string;
}

function fmt(value: number) {
  return value.toLocaleString('en-US');
}

function labelize(value: string) {
  return value.replace('_', ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export default function LearningPage() {
  const { session, user } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canPublish = can(PERMISSIONS.LEARNING_PUBLISH);
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<LearningResourceResponse | null>(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [publishedFilter, setPublishedFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [branchSelection, setBranchSelection] = useState(user?.branchId ?? '');
  const { effectiveBranchId, branches } = useEffectiveBranchId(token, user?.branchId, branchSelection);

  const { data: batches } = useBatches(token, effectiveBranchId, undefined, !!effectiveBranchId);

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => apiClient<{ data: Subject[] }>('/subjects', { token }),
    enabled: !!token,
  });

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (effectiveBranchId) params.set('branchId', effectiveBranchId);
    if (type) params.set('type', type);
    if (batchId) params.set('batchId', batchId);
    if (subjectId) params.set('subjectId', subjectId);
    if (search) params.set('search', search);
    if (publishedFilter === 'published') params.set('publishedOnly', 'true');
    return params;
  }, [batchId, effectiveBranchId, limit, page, publishedFilter, search, subjectId, type]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.learningStats,
    queryFn: () => apiClient<LearningStatsResponse>('/learning/stats', { token }),
    enabled: !!token,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.learning({
      page,
      limit,
      search,
      type,
      batchId,
      subjectId,
      publishedFilter,
      branchId: effectiveBranchId,
    }),
    queryFn: () => apiClient<PaginatedResponse<LearningResourceResponse>>(`/learning?${queryParams}`, { token }),
    enabled: !!token && !!effectiveBranchId,
  });

  const rows = useMemo(() => {
    const list = data?.data ?? [];
    if (publishedFilter === 'draft') return list.filter((item) => !item.isPublished);
    return list;
  }, [data?.data, publishedFilter]);

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      apiClient(`/learning/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ isPublished: !isPublished }),
      }),
    onSuccess: () => {
      toast.success('Learning content updated');
      queryClient.invalidateQueries({ queryKey: queryKeys.learning() });
      queryClient.invalidateQueries({ queryKey: queryKeys.learningStats });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/learning/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Learning content deleted');
      queryClient.invalidateQueries({ queryKey: queryKeys.learning() });
      queryClient.invalidateQueries({ queryKey: queryKeys.learningStats });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={BookMarked}
        title="Learning"
        description="Manage notes, materials, homework and syllabus"
        actions={
          canPublish ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setOpenCreate(true)} className={pageHeaderActionClassName}>
                <PageHeaderActionIcon />
                Add content
              </button>
              <Link
                href="/dashboard/learning/new"
                className={cn(
                  pageHeaderActionClassName,
                  'border border-stroke-soft-200 bg-white text-text-main-900 hover:bg-neutral-50',
                )}
              >
                New homework/syllabus
              </Link>
            </div>
          ) : undefined
        }
      />

      <CreateLearningDialog
        open={openCreate || !!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
          setOpenCreate(open);
        }}
        branchId={effectiveBranchId}
        resource={editing}
      />

      <MainStatsSection
        isLoading={statsLoading}
        stats={[
          { label: 'Published', value: fmt(stats?.published.total ?? 0), changePercent: stats?.published.changePercent },
          { label: 'Drafts', value: fmt(stats?.drafts.total ?? 0), changePercent: stats?.drafts.changePercent },
          { label: 'Homework', value: fmt(stats?.homework.total ?? 0), changePercent: stats?.homework.changePercent },
          { label: 'Due soon', value: fmt(stats?.dueSoon.total ?? 0), changePercent: stats?.dueSoon.changePercent },
        ]}
      />

      <FilterBar className="items-center">
        <SearchInput value={search} onValueChange={handleSearchChange} />
        <SelectDropdown aria-label="Type" placeholder="All types" value={type} onValueChange={setType} options={TYPE_OPTIONS} />
        <SelectDropdown
          aria-label="Batch"
          placeholder="All batches"
          value={batchId}
          onValueChange={setBatchId}
          options={[
            { value: '', label: 'All batches' },
            ...(batches?.data.map((b) => ({ value: b.id, label: b.name })) ?? []),
          ]}
        />
        <SelectDropdown
          aria-label="Published status"
          placeholder="All status"
          value={publishedFilter}
          onValueChange={setPublishedFilter}
          options={[
            { value: '', label: 'All status' },
            { value: 'published', label: 'Published' },
            { value: 'draft', label: 'Draft' },
          ]}
        />
        <SelectDropdown
          aria-label="Subject"
          placeholder="All subjects"
          value={subjectId}
          onValueChange={setSubjectId}
          options={[
            { value: '', label: 'All subjects' },
            ...(subjects?.data.map((s) => ({ value: s.id, label: s.name })) ?? []),
          ]}
        />
        {!user?.branchId && branches?.data && branches.data.length > 1 && (
          <SelectDropdown
            aria-label="Branch"
            placeholder="Branch"
            value={branchSelection}
            onValueChange={setBranchSelection}
            options={branches.data.map((b) => ({ value: b.id, label: b.name }))}
          />
        )}
      </FilterBar>

      <div className="bg-white">
        <div className={dataTableWrapperClass}>
          <table className={dataTableClass}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Title</th>
                <th className={dataTableThClass}>Type</th>
                <th className={dataTableThClass}>Scope</th>
                <th className={dataTableThClass}>Status</th>
                <th className={dataTableThClass}>Due</th>
                <th className={cn(dataTableThClass, 'w-12')} />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {isLoading && <DataTableSkeletonRows columns={6} rows={8} />}

              {error && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-red-600">
                    Failed to load learning content
                  </td>
                </tr>
              )}

              {!isLoading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-text-sub-500">
                    No content found
                  </td>
                </tr>
              )}

              {!isLoading &&
                !error &&
                rows.map((row) => (
                  <tr key={row.id} className={cn('transition-colors', dataTableRowHoverClass)}>
                    <td className={dataTableTdClass}>
                      <div className="min-w-0">
                        <p>{row.title}</p>
                        {row.description ? (
                          <p className="line-clamp-1 text-xs text-text-sub-500">{row.description}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className={dataTableTdClass}>{labelize(row.type)}</td>
                    <td className={dataTableTdClass}>{labelize(row.visibilityScope)}</td>
                    <td className={dataTableTdClass}>
                      <StatusBadge label={row.isPublished ? 'Published' : 'Draft'} code={row.isPublished ? 'active' : 'draft'} />
                    </td>
                    <td className={cn(dataTableTdClass, 'whitespace-nowrap')}>
                      {row.dueAt ? new Date(row.dueAt).toLocaleString() : '—'}
                    </td>
                    <td className={cn(dataTableTdClass, 'text-right')}>
                      {canPublish ? (
                        <RowActionsMenu
                          items={[
                            {
                              label: 'Edit',
                              ...(row.type === 'note' || row.type === 'material' || row.type === 'resource'
                                ? { onClick: () => setEditing(row) }
                                : { href: `/dashboard/learning/${row.id}/edit` }),
                            },
                            {
                              label: row.isPublished ? 'Unpublish' : 'Publish',
                              onClick: () =>
                                togglePublishMutation.mutate({ id: row.id, isPublished: row.isPublished }),
                            },
                            {
                              label: 'Delete',
                              onClick: () => {
                                if (confirm('Delete this learning content?')) deleteMutation.mutate(row.id);
                              },
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
        <PaginationBar
          page={data?.meta.page ?? page}
          totalPages={data?.meta.totalPages ?? 1}
          onPageChange={setPage}
          limit={limit}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
