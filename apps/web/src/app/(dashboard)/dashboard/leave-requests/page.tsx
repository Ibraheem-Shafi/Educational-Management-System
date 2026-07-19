'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import type { LeaveRequestResponse, PaginatedResponse } from '@eims/types';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { hasPermission } from '@/lib/permissions';
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { StatusBadge } from '@/components/layout/status-badge';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { PermissionGate } from '@/components/auth/permission-gate';
import { RequestLeaveDialog } from '@/components/features/leave-requests/request-leave-dialog';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { cn } from '@/lib/utils';

type Tab = 'all' | 'student' | 'employee' | 'mine';

export default function LeaveRequestsPage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canRead = hasPermission(user, PERMISSIONS.LEAVE_READ);
  const canRequest = hasPermission(user, PERMISSIONS.LEAVE_REQUEST);

  const [tab, setTab] = useState<Tab>(canRead ? 'all' : 'mine');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [requestOpen, setRequestOpen] = useState(false);

  const tabs = useMemo(() => {
    const items: Array<{ id: Tab; label: string }> = [];
    if (canRead) {
      items.push({ id: 'all', label: 'All' });
      items.push({ id: 'student', label: 'Student' });
      items.push({ id: 'employee', label: 'Staff' });
    }
    if (canRequest) {
      items.push({ id: 'mine', label: 'My requests' });
    }
    return items;
  }, [canRead, canRequest]);

  const listKind = tab === 'student' || tab === 'employee' ? tab : undefined;

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (listKind) params.set('kind', listKind);
    return params.toString();
  }, [page, limit, listKind]);

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.leaveRequests, tab, page, limit],
    queryFn: () => {
      if (tab === 'mine') {
        return apiClient<PaginatedResponse<LeaveRequestResponse>>(
          `/leave-requests/mine?${queryString}`,
          { token },
        );
      }
      return apiClient<PaginatedResponse<LeaveRequestResponse>>(
        `/leave-requests?${queryString}`,
        { token },
      );
    },
    enabled: !!token && (tab === 'mine' ? canRequest : canRead),
  });

  const review = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      apiClient(`/leave-requests/${id}`, { method: 'PATCH', body: { status }, token }),
    onSuccess: async () => {
      toast.success('Leave request updated');
      await queryClient.invalidateQueries({ queryKey: queryKeys.leaveRequests });
    },
    onError: () => toast.error('Unable to update request'),
  });

  const personLabel = (row: LeaveRequestResponse) =>
    row.kind === 'employee' ? (row.employeeName ?? 'Staff') : (row.studentName ?? 'Student');

  const handleTabChange = (next: string) => {
    setTab(next as Tab);
    setPage(1);
  };

  if (error && (tab === 'mine' ? canRequest : canRead)) {
    return <p className="text-red-600">Unable to load leave requests.</p>;
  }

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={ClipboardList}
        title="Leave requests"
        description="Review student absences and staff leave, or submit your own leave"
        actions={
          canRequest ? (
            <button
              type="button"
              onClick={() => setRequestOpen(true)}
              className={pageHeaderActionClassName}
            >
              <PageHeaderActionIcon />
              Request leave
            </button>
          ) : undefined
        }
      />

      {tabs.length > 1 && (
        <Tabs
          aria-label="Leave request views"
          tabs={tabs}
          value={tab}
          onValueChange={handleTabChange}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
        <div className={dataTableWrapperClass}>
          <table className={cn(dataTableClass, 'min-w-[720px]')}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Type</th>
                <th className={dataTableThClass}>Person</th>
                <th className={dataTableThClass}>Dates</th>
                <th className={dataTableThClass}>Reason</th>
                <th className={dataTableThClass}>Status</th>
                <th className={dataTableThClass}>Actions</th>
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {isLoading ? (
                <DataTableSkeletonRows columns={6} rows={limit} />
              ) : (data?.data.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                    No leave requests
                  </td>
                </tr>
              ) : (
                data?.data.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-[var(--neutral-50)]/50">
                    <td className={dataTableTdClass}>
                      {row.kind === 'employee' ? 'Staff' : 'Student'}
                    </td>
                    <td className={dataTableTdClass}>{personLabel(row)}</td>
                    <td className={cn(dataTableTdClass, 'whitespace-nowrap')}>
                      {row.fromDate} – {row.toDate}
                    </td>
                    <td className={dataTableTdClass}>{row.reason}</td>
                    <td className={dataTableTdClass}>
                      <StatusBadge label={row.status} code={row.status} />
                    </td>
                    <td className={dataTableTdClass}>
                      {row.status === 'pending' && tab !== 'mine' ? (
                        <PermissionGate permission={PERMISSIONS.LEAVE_MANAGE} fallback="—">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={review.isPending}
                              onClick={() => review.mutate({ id: row.id, status: 'approved' })}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={review.isPending}
                              onClick={() => review.mutate({ id: row.id, status: 'rejected' })}
                            >
                              Reject
                            </Button>
                          </div>
                        </PermissionGate>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data?.meta && (
          <PaginationBar
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
          />
        )}
      </div>

      <PermissionGate permission={PERMISSIONS.LEAVE_REQUEST}>
        <RequestLeaveDialog
          open={requestOpen}
          onOpenChange={setRequestOpen}
          onSubmitted={() => {
            setTab('mine');
            setPage(1);
          }}
        />
      </PermissionGate>
    </div>
  );
}
