'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { inquiryStatuses } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { cn } from '@/lib/utils';
import type { AdmissionInquiry } from './types';
import { formatLabel } from './types';

const emptyForm = {
  fullName: '',
  phone: '',
  email: '',
  programInterest: '',
  status: 'new',
  notes: '',
  followUpAt: '',
};

function toLocalDatetime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function InquiryDialog({
  open,
  onOpenChange,
  branchId,
  inquiry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  inquiry?: AdmissionInquiry | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const isEdit = Boolean(inquiry);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      return;
    }
    if (inquiry) {
      setForm({
        fullName: inquiry.fullName,
        phone: inquiry.phone ?? '',
        email: inquiry.email ?? '',
        programInterest: inquiry.programInterest ?? '',
        status: inquiry.status,
        notes: inquiry.notes ?? '',
        followUpAt: toLocalDatetime(inquiry.followUpAt),
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, inquiry]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!form.fullName.trim()) throw new Error('Full name is required');
      const followUpAt = form.followUpAt.trim()
        ? new Date(form.followUpAt).toISOString()
        : undefined;

      if (isEdit && inquiry) {
        return apiClient(`/inquiries/${inquiry.id}`, {
          method: 'PATCH',
          token,
          body: {
            fullName: form.fullName.trim(),
            ...(form.phone.trim() ? { phone: form.phone.trim() } : { phone: '' }),
            ...(form.email.trim() ? { email: form.email.trim() } : { email: '' }),
            ...(form.programInterest.trim()
              ? { programInterest: form.programInterest.trim() }
              : { programInterest: '' }),
            status: form.status,
            ...(form.notes.trim() ? { notes: form.notes.trim() } : { notes: '' }),
            followUpAt: followUpAt ?? null,
          },
        });
      }

      return apiClient('/inquiries', {
        method: 'POST',
        token,
        body: {
          branchId,
          fullName: form.fullName.trim(),
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          ...(form.email.trim() ? { email: form.email.trim() } : {}),
          ...(form.programInterest.trim() ? { programInterest: form.programInterest.trim() } : {}),
          status: form.status,
          ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
          ...(followUpAt ? { followUpAt } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Inquiry updated' : 'Inquiry created');
      queryClient.invalidateQueries({ queryKey: queryKeys.frontOfficeInquiries(branchId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.frontOfficeActivities(branchId) });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit = form.fullName.trim().length >= 2 && branchId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <UserPlus className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>{isEdit ? 'Edit inquiry' : 'New inquiry'}</DialogTitle>
            <DialogDescription className="mt-1">
              {isEdit ? 'Update admission inquiry details' : 'Record a new admission inquiry'}
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
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div>
              <FormFieldLabel required>Full name</FormFieldLabel>
              <input
                className={modalFieldClassName}
                placeholder="Full name"
                value={form.fullName}
                onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel>Phone</FormFieldLabel>
                <input
                  className={modalFieldClassName}
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <FormFieldLabel>Email</FormFieldLabel>
                <input
                  type="email"
                  className={modalFieldClassName}
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <FormFieldLabel>Program interest</FormFieldLabel>
              <input
                className={modalFieldClassName}
                placeholder="Program or course of interest"
                value={form.programInterest}
                onChange={(e) => setForm((prev) => ({ ...prev, programInterest: e.target.value }))}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel>Status</FormFieldLabel>
                <SelectDropdown
                  aria-label="Status"
                  placeholder="Select status"
                  value={form.status}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
                  options={inquiryStatuses.map((s) => ({ value: s, label: formatLabel(s) }))}
                  className="w-full"
                />
              </div>
              <div>
                <FormFieldLabel>Follow-up at</FormFieldLabel>
                <input
                  type="datetime-local"
                  className={modalFieldClassName}
                  value={form.followUpAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, followUpAt: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <FormFieldLabel>Notes</FormFieldLabel>
              <textarea
                className={cn(modalFieldClassName, 'min-h-[80px] resize-y py-3')}
                placeholder="Notes"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
              )}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !canSubmit}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create inquiry'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
