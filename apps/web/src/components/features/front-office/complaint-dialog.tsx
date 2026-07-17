'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquareWarning, X } from 'lucide-react';
import { toast } from 'sonner';
import { complaintStatuses, complaintTypes, priorities } from '@eims/shared';
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
import type { ComplaintRequest } from './types';
import { formatLabel } from './types';

const emptyForm = {
  type: 'complaint',
  subject: '',
  body: '',
  status: 'open',
  priority: 'normal',
  requesterName: '',
  requesterPhone: '',
};

export function ComplaintDialog({
  open,
  onOpenChange,
  branchId,
  complaint,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  complaint?: ComplaintRequest | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const isEdit = Boolean(complaint);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      return;
    }
    if (complaint) {
      setForm({
        type: complaint.type,
        subject: complaint.subject,
        body: complaint.body,
        status: complaint.status,
        priority: complaint.priority,
        requesterName: complaint.requesterName ?? '',
        requesterPhone: complaint.requesterPhone ?? '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, complaint]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!form.subject.trim() || !form.body.trim()) {
        throw new Error('Subject and description are required');
      }

      if (isEdit && complaint) {
        return apiClient(`/complaints/${complaint.id}`, {
          method: 'PATCH',
          token,
          body: {
            type: form.type,
            subject: form.subject.trim(),
            body: form.body.trim(),
            status: form.status,
            priority: form.priority,
            ...(form.requesterName.trim()
              ? { requesterName: form.requesterName.trim() }
              : { requesterName: '' }),
            ...(form.requesterPhone.trim()
              ? { requesterPhone: form.requesterPhone.trim() }
              : { requesterPhone: '' }),
          },
        });
      }

      return apiClient('/complaints', {
        method: 'POST',
        token,
        body: {
          branchId,
          type: form.type,
          subject: form.subject.trim(),
          body: form.body.trim(),
          status: form.status,
          priority: form.priority,
          ...(form.requesterName.trim() ? { requesterName: form.requesterName.trim() } : {}),
          ...(form.requesterPhone.trim() ? { requesterPhone: form.requesterPhone.trim() } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Record updated' : 'Record created');
      queryClient.invalidateQueries({ queryKey: queryKeys.frontOfficeComplaints(branchId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.frontOfficeActivities(branchId) });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit = form.subject.trim() && form.body.trim() && branchId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <MessageSquareWarning className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>{isEdit ? 'Edit record' : 'New complaint or request'}</DialogTitle>
            <DialogDescription className="mt-1">
              {isEdit ? 'Update complaint or service request' : 'Log a complaint or service request'}
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
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <FormFieldLabel required>Type</FormFieldLabel>
                <SelectDropdown
                  aria-label="Type"
                  placeholder="Select type"
                  value={form.type}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
                  options={complaintTypes.map((t) => ({ value: t, label: formatLabel(t) }))}
                  className="w-full"
                />
              </div>
              <div>
                <FormFieldLabel>Status</FormFieldLabel>
                <SelectDropdown
                  aria-label="Status"
                  placeholder="Select status"
                  value={form.status}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
                  options={complaintStatuses.map((s) => ({ value: s, label: formatLabel(s) }))}
                  className="w-full"
                />
              </div>
              <div>
                <FormFieldLabel>Priority</FormFieldLabel>
                <SelectDropdown
                  aria-label="Priority"
                  placeholder="Select priority"
                  value={form.priority}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value }))}
                  options={priorities.map((p) => ({ value: p, label: formatLabel(p) }))}
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <FormFieldLabel required>Subject</FormFieldLabel>
              <input
                className={modalFieldClassName}
                placeholder="Subject"
                value={form.subject}
                onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                required
              />
            </div>

            <div>
              <FormFieldLabel required>Description</FormFieldLabel>
              <textarea
                className={cn(modalFieldClassName, 'min-h-[100px] resize-y py-3')}
                placeholder="Details"
                value={form.body}
                onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel>Requester name</FormFieldLabel>
                <input
                  className={modalFieldClassName}
                  placeholder="Name"
                  value={form.requesterName}
                  onChange={(e) => setForm((prev) => ({ ...prev, requesterName: e.target.value }))}
                />
              </div>
              <div>
                <FormFieldLabel>Requester phone</FormFieldLabel>
                <input
                  className={modalFieldClassName}
                  placeholder="Phone"
                  value={form.requesterPhone}
                  onChange={(e) => setForm((prev) => ({ ...prev, requesterPhone: e.target.value }))}
                />
              </div>
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
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create record'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
