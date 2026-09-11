'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { withBranchScope } from '@/lib/branch-scope';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import type { NoticesStatsResponse, PaginatedResponse } from '@eims/types';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FilterBar } from '@/components/layout/filter-bar';
import { StatusBadge, statusRowClass } from '@/components/layout/status-badge';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { PaginationBar } from '@/components/layout/pagination-bar';
import {
  CreateNoticeDialog,
  type EditableNotice,
} from '@/components/features/notices/create-notice-dialog';
import { useNoticesRealtime } from '@/hooks/use-notices-realtime';
import {
  dataTableClass,
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

export default function NoticesPage() {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canMutate = can(PERMISSIONS.STUDENTS_UPDATE);
  const [createOpen, setCreateOpen] = useState(false);
  const [editNotice, setEditNotice] = useState<EditableNotice | null>(null);
  const [viewNotice, setViewNotice] = useState<Notice | null>(null);
  const [publishTarget, setPublishTarget] = useState<string | null>(null);
  const [notifyFamilies, setNotifyFamilies] = useState(true);
  const [search, setSearch] = useState('');
  const [audience, setAudience] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);

  useNoticesRealtime(NOTICES_KEYS);

  const { effectiveScope, scopeKey, singleBranchId, appendToSearchParams } =
    useEffectiveBranchScope();

  useEffect(() => {
    if (!canMutate) return;
    if (searchParams.get('create') !== '1') return;
    setCreateOpen(true);
    router.replace('/dashboard/notices', { scroll: false });
  }, [canMutate, router, searchParams]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: [...queryKeys.noticesStats, scopeKey],
    queryFn: () =>
      apiClient<NoticesStatsResponse>(withBranchScope('/notices/stats', effectiveScope), {
        token,
      }),
    enabled: !!token,
  });

  const queryString = (() => {
    const p = new URLSearchParams();
    appendToSearchParams(p);
    if (search) p.set('search', search);
    if (audience) p.set('audience', audience);
    if (statusFilter) p.set('status', statusFilter);
    p.set('page', String(page));
    p.set('limit', String(limit));
    return p.toString();
  })();

  const { data, isLoading, error } = useQuery({
    queryKey: ['notices', scopeKey, search, audience, statusFilter, page, limit],
    queryFn: () => apiClient<PaginatedResponse<Notice>>(`/notices?${queryString}`, { token }),
    enabled: !!token,
    placeholderData: (previous) => previous,
  });

  const notices = data?.data ?? [];

  const publishMutation = useMutation({
    mutationFn: ({ id, notifyFamilies: notify }: { id: string; notifyFamilies: boolean }) =>
      apiClient(`/notices/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ isPublished: true, notifyFamilies: notify }),
      }),
    onSuccess: () => {
      toast.success(
        notifyFamilies
          ? 'Notice published. Family alerts are queued.'
          : 'Notice published',
      );
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.noticesStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.communicationsStats });
      setPublishTarget(null);
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

  const handleLimitChange = useCallback((next: number) => {
    setLimit(next);
    setPage(1);
  }, []);

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
        open={createOpen || Boolean(editNotice)}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditNotice(null);
          }
        }}
        branchId={singleBranchId ?? ''}
        notice={editNotice}
      />

      <ConfirmDialog
        open={Boolean(publishTarget)}
        onOpenChange={(open) => {
          if (!open && !publishMutation.isPending) setPublishTarget(null);
        }}
        title="Publish notice"
        description="Families will see this in the portal. Optionally send a WhatsApp/SMS alert (logged if Twilio is not configured)."
        confirmLabel={notifyFamilies ? 'Publish and notify' : 'Publish without alert'}
        loading={publishMutation.isPending}
        onConfirm={() => {
          if (!publishTarget) return;
          publishMutation.mutate({ id: publishTarget, notifyFamilies });
        }}
      >
        <label className="flex items-center gap-2 text-sm text-[var(--text-main-900)]">
          <input
            type="checkbox"
            checked={notifyFamilies}
            onChange={(e) => setNotifyFamilies(e.target.checked)}
            className="h-4 w-4 accent-[var(--midnight-blue-950,#01366C)]"
          />
          Notify families by WhatsApp/SMS
        </label>
      </ConfirmDialog>

      <Dialog open={Boolean(viewNotice)} onOpenChange={(open) => !open && setViewNotice(null)}>
        <DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 p-0" aria-describedby={undefined}>
          <div className="shrink-0 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-5 py-4">
            <DialogTitle>{viewNotice?.title}</DialogTitle>
            <DialogDescription className="mt-1">
              {viewNotice ? formatAudience(viewNotice.audience) : ''} ·{' '}
              {viewNotice ? formatPublishAt(viewNotice.publishedAt) : ''}
            </DialogDescription>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-main-900,#0A0D14)]">
              {viewNotice?.body}
            </p>
          </div>
        </DialogContent>
      </Dialog>

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
        <SearchInput value={search} onValueChange={handleSearchChange} placeholder="Search by title, body, ID" />
        <SelectDropdown
          aria-label="Filter by audience"
          placeholder="All audiences"
          value={audience}
          onValueChange={(value) => {
            setAudience(value);
            setPage(1);
          }}
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
          onValueChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'published', label: 'Published' },
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'draft', label: 'Draft' },
          ]}
        />
        <PageBranchScopeControl />
        {(search || audience || statusFilter) && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setAudience('');
              setStatusFilter('');
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
                <th className={dataTableThClass}>ID</th>
                <th className={dataTableThClass}>Title</th>
                <th className={dataTableThClass}>Audience</th>
                <th className={dataTableThClass}>Status</th>
                <th className={dataTableThClass}>Publish at</th>
                <th className={cn(dataTableThClass, 'w-12')} />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {isLoading && <DataTableSkeletonRows columns={6} rows={limit} />}

              {error && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-red-600">
                    Failed to load notices
                  </td>
                </tr>
              )}

              {!isLoading && !error && notices.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]"
                  >
                    No notices found
                  </td>
                </tr>
              )}

              {!isLoading &&
                !error &&
                notices.map((notice) => {
                  const status = getNoticeStatus(notice);
                  return (
                    <tr
                      key={notice.id}
                      className={cn('transition-colors', statusRowClass(status.code, status.label))}
                    >
                      <td className={cn(dataTableTdClass, 'font-mono text-xs text-[var(--text-sub-500,#525866)]')}>
                        {notice.id.slice(0, 8).toUpperCase()}
                      </td>
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
                        <RowActionsMenu
                          items={[
                            {
                              label: 'View',
                              onClick: () => setViewNotice(notice),
                            },
                            ...(canMutate && !notice.isPublished
                              ? [
                                  {
                                    label: 'Edit',
                                    onClick: () =>
                                      setEditNotice({
                                        id: notice.id,
                                        title: notice.title,
                                        body: notice.body,
                                        audience: notice.audience,
                                        publishedAt: notice.publishedAt,
                                        isPublished: notice.isPublished,
                                      }),
                                  },
                                  {
                                    label: 'Publish now',
                                    onClick: () => {
                                      setNotifyFamilies(true);
                                      setPublishTarget(notice.id);
                                    },
                                  },
                                ]
                              : []),
                            ...(canMutate
                              ? [
                                  {
                                    label: 'Delete',
                                    onClick: () => {
                                      if (confirm('Delete this notice?')) {
                                        deleteMutation.mutate(notice.id);
                                      }
                                    },
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {data?.meta && (
          <PaginationBar
            page={page}
            totalPages={data.meta.totalPages}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={handleLimitChange}
          />
        )}
      </div>
    </div>
  );
}
