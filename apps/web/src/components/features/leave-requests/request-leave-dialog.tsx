'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Paperclip, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { createEmployeeLeaveRequestSchema } from '@eims/shared';
import type { LeaveRequestResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { uploadLeaveAttachment } from '@/lib/upload-leave-attachment';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { FormFieldError } from '@/components/forms/form-field-error';
import { queryKeys } from '@/lib/query-keys';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { DateField } from '@/components/ui/date-field';
import { cn } from '@/lib/utils';

export function RequestLeaveDialog({
  open,
  onOpenChange,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const { errors, validate, clearField, clearAll, fieldClassName, applyApiErrors } =
    useFormErrors(createEmployeeLeaveRequestSchema);

  useEffect(() => {
    if (!open) {
      setFromDate('');
      setToDate('');
      setReason('');
      setFile(null);
      clearAll();
    }
  }, [open, clearAll]);

  const createLeave = useMutation({
    mutationFn: async (body: { fromDate: string; toDate: string; reason: string }) => {
      const created = await apiClient<LeaveRequestResponse>('/leave-requests', {
        method: 'POST',
        token,
        body,
      });
      if (file && token) {
        const uploaded = await uploadLeaveAttachment(file, created.id, token);
        await apiClient(`/leave-requests/${created.id}/attachment`, {
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.leaveRequests });
      onOpenChange(false);
      onSubmitted?.();
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <CalendarDays className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Request leave</DialogTitle>
            <DialogDescription className="mt-1">
              Submit a leave request for approval
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-sub-500)] hover:bg-[var(--neutral-50)] hover:text-[var(--text-main-900)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const payload = {
              fromDate,
              toDate,
              reason: reason.trim(),
            };
            if (!validate(payload)) return;
            createLeave.mutate(payload);
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div>
              <FormFieldLabel htmlFor="leave-from" required>
                From
              </FormFieldLabel>
              <DateField
                id="leave-from"
                className={fieldClassName('fromDate', modalFieldClassName)}
                value={fromDate}
                onValueChange={(next) => {
                  setFromDate(next);
                  clearField('fromDate');
                }}
              />
              <FormFieldError message={errors.fromDate} />
            </div>
            <div>
              <FormFieldLabel htmlFor="leave-to" required>
                To
              </FormFieldLabel>
              <DateField
                id="leave-to"
                className={fieldClassName('toDate', modalFieldClassName)}
                value={toDate}
                min={fromDate || undefined}
                onValueChange={(next) => {
                  setToDate(next);
                  clearField('toDate');
                }}
              />
              <FormFieldError message={errors.toDate} />
            </div>
            <div>
              <FormFieldLabel htmlFor="leave-reason" required>
                Reason
              </FormFieldLabel>
              <textarea
                id="leave-reason"
                className={cn(fieldClassName('reason', modalFieldClassName), 'min-h-[120px] resize-y py-2')}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  clearField('reason');
                }}
                rows={5}
                maxLength={2000}
                placeholder="Explain why you need leave (medical, travel, personal, etc.)"
              />
              <div className="mt-1 flex justify-between gap-2">
                <FormFieldError message={errors.reason} />
                <p className="text-xs text-[var(--text-sub-500)]">{reason.length}/2000</p>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <FormFieldLabel>Supporting document (optional)</FormFieldLabel>
                <button
                  type="button"
                  disabled={createLeave.isPending}
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
                    <Paperclip className="h-4 w-4 shrink-0 text-[var(--text-sub-500)]" />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="rounded-md p-1 text-[var(--text-sub-500)] hover:bg-white"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-sub-500)]">
                  PDF, Word, or image — e.g. medical certificate
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={createLeave.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
              )}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={createLeave.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {createLeave.isPending ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
