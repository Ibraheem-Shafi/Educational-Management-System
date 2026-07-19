'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { createLeaveRequestSchema } from '@eims/shared';
import type { LeaveRequestResponse, PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { FormFieldError } from '@/components/forms/form-field-error';
import { queryKeys } from '@/lib/query-keys';
import { buildPortalQuery } from '@/lib/portal-api';
import type { ParentPortalData } from '@/lib/portal-types';
import { PageHeader } from '@/components/layout/page-header';
import { ContentPanel } from '@/components/layout/content-panel';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { PortalParentPageShell } from '@/components/portal/portal-parent-page-shell';
import { StatusBadge } from '@/components/layout/status-badge';
import { PaginationBar } from '@/components/layout/pagination-bar';
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
          <ParentLeaveContent
            childId={childId}
            setChildId={setChildId}
            linkedChildren={data.children}
          />
        )}
      </PortalParentPageShell>
    </div>
  );
}

function ParentLeaveContent({
  childId,
  setChildId,
  linkedChildren,
}: {
  childId: string;
  setChildId: (id: string) => void;
  linkedChildren: ParentPortalData['children'];
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const { errors, validate, clearField, fieldClassName, applyApiErrors } =
    useFormErrors(createLeaveRequestSchema);

  useEffect(() => {
    setPage(1);
  }, [childId]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.portalParentLeave(childId, page, limit),
    queryFn: () =>
      apiClient<PaginatedResponse<LeaveRequestResponse>>(
        `/portal/parent/leave${buildPortalQuery({ studentId: childId, page, limit })}`,
        { token },
      ),
    enabled: !!token && !!childId,
    placeholderData: (previous) => previous,
  });

  const handleLimitChange = useCallback((next: number) => {
    setLimit(next);
    setPage(1);
  }, []);

  const submit = useMutation({
    mutationFn: (body: { studentId: string; fromDate: string; toDate: string; reason: string }) =>
      apiClient<LeaveRequestResponse>('/portal/parent/leave', {
        method: 'POST',
        body,
        token,
      }),
    onSuccess: async () => {
      toast.success('Leave request submitted');
      setFromDate('');
      setToDate('');
      setReason('');
      await queryClient.invalidateQueries({ queryKey: queryKeys.portalParentLeave(childId) });
      setPage(1);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const handleSubmit = () => {
    const payload = {
      studentId: childId,
      fromDate,
      toDate,
      reason: reason.trim(),
    };
    if (!validate(payload)) return;
    submit.mutate(payload);
  };

  const childOptions = linkedChildren.map((c) => ({
    value: c.student.id,
    label: c.student.fullName,
  }));

  return (
    <div className="space-y-4">
      <ContentPanel title="New request">
        <div className="space-y-3 px-5 py-4">
          {linkedChildren.length > 1 && (
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
                className={fieldClassName('fromDate', 'mt-1 w-full rounded-lg border border-stroke-soft-200 px-3 py-2')}
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  clearField('fromDate');
                }}
              />
              <FormFieldError message={errors.fromDate} />
            </label>
            <label className="text-sm">
              <span className="text-[var(--text-sub-500)]">To</span>
              <input
                type="date"
                className={fieldClassName('toDate', 'mt-1 w-full rounded-lg border border-stroke-soft-200 px-3 py-2')}
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  clearField('toDate');
                }}
              />
              <FormFieldError message={errors.toDate} />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--text-sub-500)]">Reason</span>
            <textarea
              className={fieldClassName('reason', 'mt-1 w-full rounded-lg border border-stroke-soft-200 px-3 py-2')}
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                clearField('reason');
              }}
            />
            <FormFieldError message={errors.reason} />
          </label>
          <FormFieldError message={errors.studentId} />
          <Button onClick={handleSubmit} disabled={submit.isPending}>
            Submit request
          </Button>
        </div>
      </ContentPanel>

      <ContentPanel title="Your requests">
        {isLoading && !data ? (
          <PortalPageSkeleton />
        ) : (
          <>
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
          {data?.meta && data.meta.totalPages > 0 && (
            <PaginationBar
              page={page}
              totalPages={data.meta.totalPages}
              onPageChange={setPage}
              limit={limit}
              onLimitChange={handleLimitChange}
            />
          )}
          </>
        )}
      </ContentPanel>
    </div>
  );
}
