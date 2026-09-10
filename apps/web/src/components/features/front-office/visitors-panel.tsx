'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@eims/types';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { StatusBadge, statusRowClass } from '@/components/layout/status-badge';
import { PermissionGate } from '@/components/auth/permission-gate';
import { Button } from '@/components/ui/button';
import {
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { cn } from '@/lib/utils';
import { FrontOfficeDetailDialog } from './front-office-detail-dialog';
import { VisitorDialog } from './visitor-dialog';
import type { Visitor } from './types';
import { formatDateTime } from './types';

export function VisitorsPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.FRONT_OFFICE_MANAGE);

  const [search, setSearch] = useState('');
  const [checkedInFilter, setCheckedInFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewVisitor, setViewVisitor] = useState<Visitor | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleLimitChange = useCallback((next: number) => {
    setLimit(next);
    setPage(1);
  }, []);

  const queryParams = {
    branchId,
    page,
    limit,
    ...(search ? { search } : {}),
    ...(checkedInFilter === 'in' ? { checkedInOnly: true } : {}),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.frontOfficeVisitors(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({
        branchId,
        page: String(page),
        limit: String(limit),
      });
      if (search) params.set('search', search);
      if (checkedInFilter === 'in') params.set('checkedInOnly', 'true');
      return apiClient<PaginatedResponse<Visitor>>(`/visitors?${params.toString()}`, { token });
    },
    enabled: !!token && !!branchId,
    placeholderData: (previous) => previous,
  });

  const checkOut = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/visitors/${id}`, { method: 'PATCH', token, body: { checkOut: true } }),
    onSuccess: async () => {
      toast.success('Visitor checked out');
      await queryClient.invalidateQueries({ queryKey: queryKeys.frontOfficeVisitors(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.frontOfficeActivities(branchId) });
    },
    onError: () => toast.error('Unable to check out visitor'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient(`/visitors/${id}`, { method: 'DELETE', token }),
    onSuccess: async () => {
      toast.success('Visitor record deleted');
      await queryClient.invalidateQueries({ queryKey: queryKeys.frontOfficeVisitors(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.frontOfficeActivities(branchId) });
    },
    onError: () => toast.error('Unable to delete visitor'),
  });

  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`Visitors (${data?.meta.total ?? 0})`}
        actions={
          <PermissionGate permission={PERMISSIONS.FRONT_OFFICE_MANAGE}>
            <button
              type="button"
              className={pageHeaderActionClassName}
              onClick={() => setCreateOpen(true)}
            >
              <PageHeaderActionIcon />
              Check in visitor
            </button>
          </PermissionGate>
        }
      >
        <div className="border-b border-stroke-soft-200 px-5 py-4">
          <FilterBar>
            <SearchInput
              value={search}
              onValueChange={handleSearchChange}
              placeholder="Search by name, phone, host"
              className="min-w-[220px] flex-1 sm:max-w-xs"
            />
            <SelectDropdown
              aria-label="Check-in filter"
              placeholder="All visitors"
              value={checkedInFilter}
              onValueChange={(next) => {
                setCheckedInFilter(next);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All visitors' },
                { value: 'in', label: 'Checked in only' },
              ]}
              className="w-full sm:w-[180px]"
            />
            {(search || checkedInFilter) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setCheckedInFilter('');
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterBar>
        </div>

        {error ? (
          <p className="px-5 py-8 text-sm text-red-600">Unable to load visitors.</p>
        ) : (
          <>
            <div className={dataTableWrapperClass}>
              <table className={cn(dataTableClass, 'min-w-[880px]')}>
              <thead>
                <tr>
                  <th className={dataTableThClass}>Name</th>
                  <th className={dataTableThClass}>Phone</th>
                  <th className={dataTableThClass}>Purpose</th>
                  <th className={dataTableThClass}>Host</th>
                  <th className={dataTableThClass}>Check-in</th>
                  <th className={dataTableThClass}>Status</th>
                  <th className={dataTableThClass}>Actions</th>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {isLoading ? (
                  <DataTableSkeletonRows columns={7} rows={limit} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                      No visitors found
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const isCheckedIn = !row.checkedOutAt;
                    return (
                      <tr
                        key={row.id}
                        className={statusRowClass(
                          isCheckedIn ? 'present' : 'inactive',
                          isCheckedIn ? 'Checked in' : 'Checked out',
                        )}
                      >
                        <td className={dataTableTdClass}>{row.fullName}</td>
                        <td className={dataTableTdClass}>{row.phone ?? '—'}</td>
                        <td className={dataTableTdClass}>{row.purpose ?? '—'}</td>
                        <td className={dataTableTdClass}>{row.hostName ?? '—'}</td>
                        <td className={dataTableTdClass}>{formatDateTime(row.checkedInAt)}</td>
                        <td className={dataTableTdClass}>
                          <StatusBadge
                            label={isCheckedIn ? 'Checked in' : 'Checked out'}
                            code={isCheckedIn ? 'present' : 'inactive'}
                          />
                        </td>
                        <td className={dataTableTdClass}>
                          <RowActionsMenu
                            items={[
                              { label: 'View', onClick: () => setViewVisitor(row) },
                              ...(canManage && isCheckedIn
                                ? [
                                    {
                                      label: 'Check out',
                                      onClick: () => checkOut.mutate(row.id),
                                    },
                                  ]
                                : []),
                              ...(canManage
                                ? [
                                    {
                                      label: 'Delete',
                                      onClick: () => {
                                        if (window.confirm('Delete this visitor record?')) {
                                          remove.mutate(row.id);
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
                  })
                )}
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
          </>
        )}
      </ContentPanel>

      <VisitorDialog open={createOpen} onOpenChange={setCreateOpen} branchId={branchId} />
      <FrontOfficeDetailDialog
        open={Boolean(viewVisitor)}
        onOpenChange={(open) => {
          if (!open) setViewVisitor(null);
        }}
        title="Visitor details"
        description="Visitor check-in record"
        icon={UserRound}
        fields={
          viewVisitor
            ? [
                { label: 'Full name', value: viewVisitor.fullName },
                { label: 'Phone', value: viewVisitor.phone ?? '—' },
                { label: 'Purpose', value: viewVisitor.purpose ?? '—' },
                { label: 'Host', value: viewVisitor.hostName ?? '—' },
                { label: 'Checked in', value: formatDateTime(viewVisitor.checkedInAt) },
                {
                  label: 'Checked out',
                  value: viewVisitor.checkedOutAt
                    ? formatDateTime(viewVisitor.checkedOutAt)
                    : 'Still checked in',
                },
                {
                  label: 'Status',
                  value: (
                    <StatusBadge
                      label={viewVisitor.checkedOutAt ? 'Checked out' : 'Checked in'}
                      code={viewVisitor.checkedOutAt ? 'inactive' : 'present'}
                    />
                  ),
                },
                { label: 'Created', value: formatDateTime(viewVisitor.createdAt) },
                { label: 'Notes', value: viewVisitor.notes ?? '—', fullWidth: true },
              ]
            : []
        }
      />
    </>
  );
}
