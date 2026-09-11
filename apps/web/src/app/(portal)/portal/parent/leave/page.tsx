'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Paperclip, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { createLeaveRequestSchema } from '@eims/shared';
import type { LeaveRequestResponse, PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { uploadLeaveAttachment } from '@/lib/upload-leave-attachment';
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
import { StatusBadge, statusRowClass } from '@/components/layout/status-badge';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { LeaveRequestDetailDialog } from '@/components/features/leave-requests/leave-request-detail-dialog';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [detailRequest, setDetailRequest] = useState<LeaveRequestResponse | null>(null);
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
    mutationFn: async (body: { studentId: string; fromDate: string; toDate: string; reason: string }) => {
      const created = await apiClient<LeaveRequestResponse>('/portal/parent/leave', {
        method: 'POST',
        body,
        token,
      });
      if (file && token) {
        const uploaded = await uploadLeaveAttachment(file, created.id, token, { portal: true });
        await apiClient(`/portal/parent/leave/${created.id}/attachment`, {
          method: 'POST',
          token,
          body: JSON.stringify({
            fileName: uploaded.fileName,
            storagePath: uploaded.path,
            mimeType: uploaded.mimeType,
            sizeBytes: uploaded.sizeBytes,
          }),
        });
      }
      return created;
    },
    onSuccess: async () => {
      toast.success('Leave request submitted');
      setFromDate('');
      setToDate('');
      setReason('');
      setFile(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.portalParentLeave(childId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.leaveRequests });
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
              <DateField
                className={fieldClassName('fromDate', 'mt-1 w-full rounded-lg border border-stroke-soft-200 px-3 py-2')}
                value={fromDate}
                onValueChange={(next) => {
                  setFromDate(next);
                  clearField('fromDate');
                }}
              />
              <FormFieldError message={errors.fromDate} />
            </label>
            <label className="text-sm">
              <span className="text-[var(--text-sub-500)]">To</span>
              <DateField
                className={fieldClassName('toDate', 'mt-1 w-full rounded-lg border border-stroke-soft-200 px-3 py-2')}
                value={toDate}
                min={fromDate || undefined}
                onValueChange={(next) => {
                  setToDate(next);
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
              rows={5}
              maxLength={2000}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                clearField('reason');
              }}
              placeholder="Explain the absence in detail if needed"
            />
            <div className="mt-1 flex justify-between gap-2">
              <FormFieldError message={errors.reason} />
              <p className="text-xs text-[var(--text-sub-500)]">{reason.length}/2000</p>
            </div>
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm text-[var(--text-sub-500)]">Supporting document (optional)</span>
              <button
                type="button"
                disabled={submit.isPending}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md border border-stroke-soft-200 px-2.5 py-1 text-sm text-[var(--text-sub-500)] hover:bg-neutral-50"
              >
                <Upload className="h-4 w-4" />
                {file ? 'Change file' : 'Attach file'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,image/*,application/pdf"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
            </div>
            {file ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-stroke-soft-200 bg-neutral-50 px-3 py-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <Paperclip className="h-4 w-4 shrink-0" />
                  <span className="truncate">{file.name}</span>
                </div>
                <button type="button" onClick={() => setFile(null)} aria-label="Remove file">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>

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
                    <tr
                      key={row.id}
                      className={statusRowClass(row.status, row.status)}
                    >
                      <td className={dataTableTdClass}>{row.studentName}</td>
                      <td className={dataTableTdClass}>
                        {row.fromDate} – {row.toDate}
                      </td>
                      <td className={cn(dataTableTdClass, 'max-w-[220px]')}>
                        <button
                          type="button"
                          onClick={() => setDetailRequest(row)}
                          className="block w-full text-left"
                        >
                          <span className="line-clamp-2 text-sm">{row.reason}</span>
                          <span className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--institution-primary)]">
                            {row.attachmentFileName ? (
                              <>
                                <Paperclip className="h-3 w-3" />
                                View reason & file
                              </>
                            ) : (
                              'View full reason'
                            )}
                          </span>
                        </button>
                      </td>
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

      <LeaveRequestDetailDialog
        open={!!detailRequest}
        onOpenChange={(next) => {
          if (!next) setDetailRequest(null);
        }}
        request={detailRequest}
        personLabel={detailRequest?.studentName ?? 'Student'}
        signedUrlPath={
          detailRequest ? `/portal/parent/leave/${detailRequest.id}` : undefined
        }
      />
    </div>
  );
}
