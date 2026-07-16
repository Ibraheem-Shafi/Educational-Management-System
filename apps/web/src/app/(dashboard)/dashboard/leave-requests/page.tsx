'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import type { LeaveRequestResponse } from '@eims/types';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader } from '@/components/layout/page-header';
import { ContentPanel } from '@/components/layout/content-panel';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { StatusBadge } from '@/components/layout/status-badge';
import { Button } from '@/components/ui/button';
import { PermissionGate } from '@/components/auth/permission-gate';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { cn } from '@/lib/utils';

export default function LeaveRequestsPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.leaveRequests,
    queryFn: () => apiClient<{ data: LeaveRequestResponse[] }>('/leave-requests', { token }),
    enabled: !!token,
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

  if (isLoading && !data) return <PortalPageSkeleton />;
  if (error) return <p className="text-red-600">Unable to load leave requests.</p>;

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={ClipboardList}
        title="Leave requests"
        description="Review and approve parent-submitted absence requests"
      />

      <ContentPanel title={`Requests (${data?.data.length ?? 0})`}>
        <div className={dataTableWrapperClass}>
          <table className={cn(dataTableClass, 'min-w-[720px]')}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Student</th>
                <th className={dataTableThClass}>Dates</th>
                <th className={dataTableThClass}>Reason</th>
                <th className={dataTableThClass}>Status</th>
                <th className={dataTableThClass}>Actions</th>
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {(data?.data.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                    No leave requests
                  </td>
                </tr>
              ) : (
                data?.data.map((row) => (
                  <tr key={row.id}>
                    <td className={dataTableTdClass}>{row.studentName}</td>
                    <td className={dataTableTdClass}>
                      {row.fromDate} – {row.toDate}
                    </td>
                    <td className={dataTableTdClass}>{row.reason}</td>
                    <td className={dataTableTdClass}>
                      <StatusBadge label={row.status} code={row.status} />
                    </td>
                    <td className={dataTableTdClass}>
                      {row.status === 'pending' ? (
                        <PermissionGate permission={PERMISSIONS.STUDENTS_UPDATE} fallback="—">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => review.mutate({ id: row.id, status: 'approved' })}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
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
      </ContentPanel>
    </div>
  );
}
