'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import type { LeaveRequestResponse } from '@eims/types';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { hasPermission } from '@/lib/permissions';
import { PageHeader } from '@/components/layout/page-header';
import { ContentPanel } from '@/components/layout/content-panel';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { StatusBadge } from '@/components/layout/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PermissionGate } from '@/components/auth/permission-gate';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { cn } from '@/lib/utils';

type Tab = 'all' | 'student' | 'employee' | 'mine';

export default function LeaveRequestsPage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canRead = hasPermission(user, PERMISSIONS.LEAVE_READ);
  const canRequest = hasPermission(user, PERMISSIONS.LEAVE_REQUEST);
  const [tab, setTab] = useState<Tab>(canRead ? 'all' : 'mine');
  const [form, setForm] = useState({ fromDate: '', toDate: '', reason: '' });

  const listKind = tab === 'student' || tab === 'employee' ? tab : undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.leaveRequests, tab],
    queryFn: () => {
      if (tab === 'mine') {
        return apiClient<{ data: LeaveRequestResponse[] }>('/leave-requests/mine', { token });
      }
      const qs = listKind ? `?kind=${listKind}` : '';
      return apiClient<{ data: LeaveRequestResponse[] }>(`/leave-requests${qs}`, { token });
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

  const createLeave = useMutation({
    mutationFn: () =>
      apiClient('/leave-requests', {
        method: 'POST',
        body: form,
        token,
      }),
    onSuccess: async () => {
      toast.success('Leave request submitted');
      setForm({ fromDate: '', toDate: '', reason: '' });
      setTab('mine');
      await queryClient.invalidateQueries({ queryKey: queryKeys.leaveRequests });
    },
    onError: () => toast.error('Unable to submit leave request'),
  });

  if (isLoading && !data && tab !== 'mine') return <PortalPageSkeleton />;
  if (error && canRead && tab !== 'mine') {
    return <p className="text-red-600">Unable to load leave requests.</p>;
  }

  const personLabel = (row: LeaveRequestResponse) =>
    row.kind === 'employee'
      ? (row.employeeName ?? 'Staff')
      : (row.studentName ?? 'Student');

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={ClipboardList}
        title="Leave requests"
        description="Review student absences and staff leave, or submit your own leave"
      />

      <PermissionGate permission={PERMISSIONS.LEAVE_REQUEST}>
        <ContentPanel title="Request leave">
          <form
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.fromDate || !form.toDate || form.reason.trim().length < 3) {
                toast.error('Fill dates and a reason (min 3 characters)');
                return;
              }
              createLeave.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="leave-from">From</Label>
              <Input
                id="leave-from"
                type="date"
                value={form.fromDate}
                onChange={(e) => setForm((p) => ({ ...p, fromDate: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="leave-to">To</Label>
              <Input
                id="leave-to"
                type="date"
                value={form.toDate}
                onChange={(e) => setForm((p) => ({ ...p, toDate: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="leave-reason">Reason</Label>
              <Textarea
                id="leave-reason"
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                rows={2}
                required
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={createLeave.isPending}>
                {createLeave.isPending ? 'Submitting…' : 'Submit leave request'}
              </Button>
            </div>
          </form>
        </ContentPanel>
      </PermissionGate>

      <div className="flex flex-wrap gap-2">
        {canRead &&
          (
            [
              ['all', 'All'],
              ['student', 'Student'],
              ['employee', 'Staff'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={tab === key ? 'default' : 'outline'}
              onClick={() => setTab(key)}
            >
              {label}
            </Button>
          ))}
        {canRequest && (
          <Button
            size="sm"
            variant={tab === 'mine' ? 'default' : 'outline'}
            onClick={() => setTab('mine')}
          >
            My requests
          </Button>
        )}
      </div>

      <ContentPanel title={`Requests (${data?.data.length ?? 0})`}>
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
              {(data?.data.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                    No leave requests
                  </td>
                </tr>
              ) : (
                data?.data.map((row) => (
                  <tr key={row.id}>
                    <td className={dataTableTdClass}>
                      {row.kind === 'employee' ? 'Staff' : 'Student'}
                    </td>
                    <td className={dataTableTdClass}>{personLabel(row)}</td>
                    <td className={dataTableTdClass}>
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
