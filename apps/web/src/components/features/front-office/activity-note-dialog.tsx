'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StickyNote, X } from 'lucide-react';
import { toast } from 'sonner';
import { createActivityNoteSchema } from '@eims/shared';
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
import { cn } from '@/lib/utils';

export function ActivityNoteDialog({
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
  const [summary, setSummary] = useState('');

  const { errors, validate, clearField, clearAll, applyApiErrors, fieldClassName } =
    useFormErrors(createActivityNoteSchema);

  useEffect(() => {
    if (!open) {
      setSummary('');
      clearAll();
    }
  }, [open, clearAll]);

  const buildPayload = () => ({
    branchId,
    summary: summary.trim(),
  });

  const mutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildPayload>) =>
      apiClient('/reception/activities', {
        method: 'POST',
        token,
        body: payload,
      }),
    onSuccess: () => {
      toast.success('Note added');
      queryClient.invalidateQueries({ queryKey: queryKeys.frontOfficeActivities(branchId) });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message || 'Unable to add note');
    },
  });

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
            <StickyNote className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Add reception note</DialogTitle>
            <DialogDescription className="mt-1">Record a manual note in the activity log</DialogDescription>
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
              <FormFieldLabel required>Note</FormFieldLabel>
              <textarea
                className={cn(fieldClassName('summary', modalFieldClassName), 'min-h-[100px] resize-y py-3')}
                placeholder="What happened at reception?"
                value={summary}
                onChange={(e) => {
                  setSummary(e.target.value);
                  clearField('summary');
                }}
                maxLength={500}
              />
              <FormFieldError message={errors.summary} />
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
              {mutation.isPending ? 'Saving…' : 'Add note'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
