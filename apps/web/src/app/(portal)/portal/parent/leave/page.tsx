'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import type { LeaveRequestResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { buildPortalQuery } from '@/lib/portal-api';
import type { ParentPortalData } from '@/lib/portal-types';
import { PageHeader } from '@/components/layout/page-header';
import { ContentPanel } from '@/components/layout/content-panel';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { PortalParentPageShell } from '@/components/portal/portal-parent-page-shell';
import { StatusBadge } from '@/components/layout/status-badge';
import { Button } from '@/components/ui/button';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { cn } from '@/lib/utils';

export default function ParentLeavePage() {
  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={ClipboardList}
        title="Leave requests"
        description="Apply for absence and track approval status"
      />
      <PortalParentPageShell>
        {({ childId, setChildId, data }) => (
          <ParentLeaveContent childId={childId} setChildId={setChildId} children={data.children} />
        )}
      </PortalParentPageShell>
    </div>
  );
}

function ParentLeaveContent({
  childId,
  setChildId,
  children,
}: {
  childId: string;
  setChildId: (id: string) => void;
  children: ParentPortalData['children'];
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.portalParentLeave(childId),
    queryFn: () =>
      apiClient<{ data: LeaveRequestResponse[] }>(
        `/portal/parent/leave${buildPortalQuery({ studentId: childId })}`,
        { token },
      ),
    enabled: !!token && !!childId,
  });

  const submit = useMutation({
    mutationFn: () =>
      apiClient<LeaveRequestResponse>('/portal/parent/leave', {
        method: 'POST',
        body: { studentId: childId, fromDate, toDate, reason },
        token,
      }),
    onSuccess: async () => {
      toast.success('Leave request submitted');
      setFromDate('');
      setToDate('');
      setReason('');
      await queryClient.invalidateQueries({ queryKey: queryKeys.portalParentLeave(childId) });
    },
    onError: () => toast.error('Unable to submit leave request'),
  });

  const childOptions = children.map((c) => ({
    value: c.student.id,
    label: c.student.fullName,
  }));

  return (
    <div className="space-y-4">
      <ContentPanel title="New request">
        <div className="space-y-3 px-5 py-4">
          {children.length > 1 && (
            <SelectDropdown
              value={childId}
              onValueChange={setChildId}
              options={childOptions}
              placeholder="Select child"
              aria-label="Select child"
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="text-[var(--text-sub-500)]">From</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-stroke-soft-200 px-3 py-2"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="text-[var(--text-sub-500)]">To</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-stroke-soft-200 px-3 py-2"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--text-sub-500)]">Reason</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-stroke-soft-200 px-3 py-2"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <Button
            onClick={() => submit.mutate()}
            disabled={!fromDate || !toDate || reason.length < 3 || submit.isPending}
          >
            Submit request
          </Button>
        </div>
      </ContentPanel>

      <ContentPanel title="Your requests">
        {isLoading && !data ? (
          <PortalPageSkeleton />
        ) : (
          <div className={dataTableWrapperClass}>
            <table className={cn(dataTableClass, 'min-w-[640px]')}>
              <thead>
                <tr>
                  <th className={dataTableThClass}>Child</th>
                  <th className={dataTableThClass}>Dates</th>
                  <th className={dataTableThClass}>Reason</th>
                  <th className={dataTableThClass}>Status</th>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {(data?.data.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                      No leave requests yet
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </ContentPanel>
    </div>
  );
}
