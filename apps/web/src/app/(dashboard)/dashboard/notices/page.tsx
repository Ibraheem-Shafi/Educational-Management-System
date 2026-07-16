'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchId } from '@/hooks/use-branches';
import type { NoticesStatsResponse } from '@eims/types';
import { Button } from '@/components/ui/button';
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FilterBar } from '@/components/layout/filter-bar';
import { StatusBadge } from '@/components/layout/status-badge';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { CreateNoticeDialog } from '@/components/features/notices/create-notice-dialog';
import { useNoticesRealtime } from '@/hooks/use-notices-realtime';
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

const NOTICES_KEYS = ['notices'] as const;

interface Notice {
  id: string;
  title: string;
  body: string;
  audience: string;
  isPublished: boolean;
  publishedAt: string | null;
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function formatAudience(audience: string): string {
  return audience.charAt(0).toUpperCase() + audience.slice(1);
}

function formatPublishAt(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getNoticeStatus(notice: Notice): { label: string; code: string } {
  if (notice.isPublished) return { label: 'Published', code: 'active' };
  if (notice.publishedAt && new Date(notice.publishedAt).getTime() > Date.now()) {
    return { label: 'Scheduled', code: 'pending' };
  }
  return { label: 'Draft', code: 'draft' };
}

function matchesStatusFilter(notice: Notice, statusFilter: string): boolean {
  if (!statusFilter) return true;
  const status = getNoticeStatus(notice).label.toLowerCase();
  return status === statusFilter;
}

export default function NoticesPage() {
  const { session, user } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canMutate = can(PERMISSIONS.STUDENTS_UPDATE);
  const [createOpen, setCreateOpen] = useState(false);
  const [branchId, setBranchId] = useState(user?.branchId ?? '');
  const [search, setSearch] = useState('');
  const [audience, setAudience] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useNoticesRealtime(NOTICES_KEYS);

  const { effectiveBranchId, branches } = useEffectiveBranchId(token, user?.branchId, branchId);

  useEffect(() => {
    if (!canMutate) return;
    if (searchParams.get('create') !== '1') return;
    setCreateOpen(true);
    router.replace('/dashboard/notices', { scroll: false });
  }, [canMutate, router, searchParams]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.noticesStats,
    queryFn: () => apiClient<NoticesStatsResponse>('/notices/stats', { token }),
    enabled: !!token,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['notices', effectiveBranchId],
    queryFn: () =>
      apiClient<{ data: Notice[] }>(`/notices?branchId=${effectiveBranchId}`, { token }),
    enabled: !!token && !!effectiveBranchId,
  });

  const filteredNotices = useMemo(() => {
    const list = data?.data ?? [];
    return list.filter((notice) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !notice.title.toLowerCase().includes(q) &&
          !notice.body.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (audience && notice.audience !== audience) return false;
      if (!matchesStatusFilter(notice, statusFilter)) return false;
      return true;
    });
  }, [data?.data, search, audience, statusFilter]);

  const publishMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/notices/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ isPublished: true }),
      }),
    onSuccess: () => {
      toast.success('Notice published');
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.noticesStats });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/notices/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Notice deleted');
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.noticesStats });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={Megaphone}
        title="Notices"
        description="Announcements for staff and portals"
        actions={
          canMutate ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className={pageHeaderActionClassName}
            >
              <PageHeaderActionIcon />
              New notice
            </button>
          ) : undefined
        }
      />

      <CreateNoticeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        branchId={effectiveBranchId}
      />

      <MainStatsSection
        isLoading={statsLoading}
        stats={[
          {
            label: 'Published',
            value: formatCount(stats?.published.total ?? 0),
            changePercent: stats?.published.changePercent,
          },
          {
            label: 'Drafts',
            value: formatCount(stats?.draft.total ?? 0),
            changePercent: stats?.draft.changePercent,
          },
          {
            label: 'Scheduled',
            value: formatCount(stats?.scheduled.total ?? 0),
            changePercent: stats?.scheduled.changePercent,
          },
          {
            label: 'Total views',
            value: formatCount(stats?.totalViews.total ?? 0),
            changePercent: stats?.totalViews.changePercent,
          },
        ]}
      />

      <FilterBar className="items-center">
        <SearchInput value={search} onValueChange={handleSearchChange} />
        <SelectDropdown
          aria-label="Filter by audience"
          placeholder="All audiences"
          value={audience}
          onValueChange={setAudience}
          options={[
            { value: '', label: 'All audiences' },
            { value: 'all', label: 'Everyone' },
            { value: 'parents', label: 'Parents' },
            { value: 'students', label: 'Students' },
            { value: 'staff', label: 'Staff' },
            { value: 'teachers', label: 'Teachers' },
          ]}
        />
        <SelectDropdown
          aria-label="Filter by status"
          placeholder="All statuses"
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'published', label: 'Published' },
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'draft', label: 'Draft' },
          ]}
        />
        {!user?.branchId && branches?.data && branches.data.length > 1 && (
          <SelectDropdown
            aria-label="Branch"
            placeholder="Select branch"
            value={branchId}
            onValueChange={setBranchId}
            options={branches.data.map((b) => ({ value: b.id, label: b.name }))}
          />
        )}
        {(search || audience || statusFilter) && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setAudience('');
              setStatusFilter('');
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
                <th className={dataTableThClass}>Title</th>
                <th className={dataTableThClass}>Audience</th>
                <th className={dataTableThClass}>Status</th>
                <th className={dataTableThClass}>Publish at</th>
                <th className={cn(dataTableThClass, 'w-12')} />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {isLoading && <DataTableSkeletonRows columns={5} rows={8} />}

              {error && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-red-600">
                    Failed to load notices
                  </td>
                </tr>
              )}

              {!isLoading && !error && filteredNotices.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]"
                  >
                    No notices found
                  </td>
                </tr>
              )}

              {!isLoading &&
                !error &&
                filteredNotices.map((notice) => {
                  const status = getNoticeStatus(notice);
                  return (
                    <tr key={notice.id} className={cn('transition-colors', dataTableRowHoverClass)}>
                      <td className={dataTableTdClass}>
                        <div className="min-w-0">
                          <p className="font-normal text-[var(--text-main-900,#0A0D14)]">
                            {notice.title}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-sm text-[var(--text-sub-500,#525866)]">
                            {notice.body}
                          </p>
                        </div>
                      </td>
                      <td className={dataTableTdClass}>{formatAudience(notice.audience)}</td>
                      <td className={dataTableTdClass}>
                        <StatusBadge label={status.label} code={status.code} />
                      </td>
                      <td className={dataTableTdClass}>{formatPublishAt(notice.publishedAt)}</td>
                      <td className={cn(dataTableTdClass, 'text-right')}>
                        {canMutate ? (
                          <RowActionsMenu
                            items={[
                              ...(!notice.isPublished
                                ? [
                                    {
                                      label: 'Publish now',
                                      onClick: () => publishMutation.mutate(notice.id),
                                    },
                                  ]
                                : []),
                              {
                                label: 'Delete',
                                onClick: () => {
                                  if (confirm('Delete this notice?')) {
                                    deleteMutation.mutate(notice.id);
                                  }
                                },
                              },
                            ]}
                          />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
