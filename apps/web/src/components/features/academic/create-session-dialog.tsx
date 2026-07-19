'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, X } from 'lucide-react';
import { toast } from 'sonner';
import { createAcademicSessionSchema } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
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
import { cn } from '@/lib/utils';

function invalidateAcademic(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['programs'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.programs() });
  queryClient.invalidateQueries({ queryKey: ['batches'] });
  queryClient.invalidateQueries({ queryKey: ['subjects'] });
  queryClient.invalidateQueries({ queryKey: ['academic-sessions'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.academicStats() });
}

export function CreateSessionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { errors, validate, clearField, clearAll, fieldClassName, applyApiErrors } =
    useFormErrors(createAcademicSessionSchema);

  useEffect(() => {
    if (!open) {
      setName('');
      setStartDate('');
      setEndDate('');
      clearAll();
    }
  }, [open, clearAll]);

  const createSession = useMutation({
    mutationFn: (body: { name: string; startDate: string; endDate: string; isCurrent?: boolean }) =>
      apiClient('/academic-sessions', { method: 'POST', token, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Session created');
      invalidateAcademic(queryClient);
      onOpenChange(false);
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
            <DialogTitle>Add academic session</DialogTitle>
            <DialogDescription className="mt-1">Define a new academic year or term</DialogDescription>
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
            const payload = {
              name: name.trim(),
              startDate: new Date(startDate).toISOString(),
              endDate: new Date(endDate).toISOString(),
              isCurrent: true,
            };
            if (!validate(payload)) return;
            createSession.mutate(payload);
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div>
              <FormFieldLabel required>Name</FormFieldLabel>
              <input
                className={fieldClassName('name', modalFieldClassName)}
                placeholder="Name (e.g. 2026)"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearField('name');
                }}
              />
              <FormFieldError message={errors.name} />
            </div>
            <div>
              <FormFieldLabel required>Start date</FormFieldLabel>
              <input
                type="date"
                className={fieldClassName('startDate', modalFieldClassName)}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  clearField('startDate');
                }}
              />
              <FormFieldError message={errors.startDate} />
            </div>
            <div>
              <FormFieldLabel required>End date</FormFieldLabel>
              <input
                type="date"
                className={fieldClassName('endDate', modalFieldClassName)}
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  clearField('endDate');
                }}
              />
              <FormFieldError message={errors.endDate} />
            </div>
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={createSession.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
              )}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={createSession.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {createSession.isPending ? 'Saving…' : 'Add session'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
