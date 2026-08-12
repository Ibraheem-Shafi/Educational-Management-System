'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DoorOpen, X } from 'lucide-react';
import { toast } from 'sonner';
import { createVisitorSchema, normalizePakistanPhone } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { queryKeys } from '@/lib/query-keys';
import { useFormErrors } from '@/hooks/use-form-errors';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormFieldError } from '@/components/forms/form-field-error';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { PakistanPhoneInput } from '@/components/ui/pakistan-phone-input';
import { cn } from '@/lib/utils';

const emptyForm = {
  fullName: '',
  phone: '',
  purpose: '',
  hostName: '',
  notes: '',
};

export function VisitorDialog({
  open,
  onOpenChange,
  branchId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const { errors, validate, clearField, clearAll, applyApiErrors, fieldClassName } =
    useFormErrors(createVisitorSchema);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      clearAll();
    }
  }, [open, clearAll]);

  const buildPayload = () => ({
    branchId,
    fullName: form.fullName.trim(),
    ...(form.phone.trim() ? { phone: normalizePakistanPhone(form.phone.trim()) } : {}),
    ...(form.purpose.trim() ? { purpose: form.purpose.trim() } : {}),
    ...(form.hostName.trim() ? { hostName: form.hostName.trim() } : {}),
    ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
  });

  const mutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildPayload>) =>
      apiClient('/visitors', {
        method: 'POST',
        token,
        body: payload,
      }),
    onSuccess: () => {
      toast.success('Visitor checked in');
      queryClient.invalidateQueries({ queryKey: queryKeys.frontOfficeVisitors(branchId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.frontOfficeActivities(branchId) });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message || 'Unable to check in visitor');
    },
  });

  const updateForm = (key: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    clearField(key);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    if (!validate(payload)) return;
    mutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <DoorOpen className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Check in visitor</DialogTitle>
            <DialogDescription className="mt-1">Register a visitor at reception</DialogDescription>
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

        <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={handleSubmit}>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div>
              <FormFieldLabel required>Full name</FormFieldLabel>
              <input
                className={fieldClassName('fullName', modalFieldClassName)}
                placeholder="Visitor name"
                value={form.fullName}
                onChange={(e) => updateForm('fullName', e.target.value)}
              />
              <FormFieldError message={errors.fullName} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel>Phone</FormFieldLabel>
                <PakistanPhoneInput
                  value={form.phone}
                  onChange={(value) => updateForm('phone', value)}
                  className={errors.phone ? 'border-red-500' : undefined}
                />
                <FormFieldError message={errors.phone} />
              </div>
              <div>
                <FormFieldLabel>Host</FormFieldLabel>
                <input
                  className={fieldClassName('hostName', modalFieldClassName)}
                  placeholder="Person visiting"
                  value={form.hostName}
                  onChange={(e) => updateForm('hostName', e.target.value)}
                />
                <FormFieldError message={errors.hostName} />
              </div>
            </div>

            <div>
              <FormFieldLabel>Purpose</FormFieldLabel>
              <input
                className={fieldClassName('purpose', modalFieldClassName)}
                placeholder="Purpose of visit"
                value={form.purpose}
                onChange={(e) => updateForm('purpose', e.target.value)}
              />
              <FormFieldError message={errors.purpose} />
            </div>

            <div>
              <FormFieldLabel>Notes</FormFieldLabel>
              <textarea
                className={cn(fieldClassName('notes', modalFieldClassName), 'min-h-[80px] resize-y py-3')}
                placeholder="Notes"
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
              />
              <FormFieldError message={errors.notes} />
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
              disabled={mutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {mutation.isPending ? 'Saving…' : 'Check in'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
