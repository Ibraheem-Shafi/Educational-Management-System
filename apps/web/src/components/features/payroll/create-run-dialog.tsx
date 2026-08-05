'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, X } from 'lucide-react';
import { toast } from 'sonner';
import { createPayrollRunSchema } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { FormFieldError } from '@/components/forms/form-field-error';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }),
}));

export function CreateRunDialog({
  branchId,
  open,
  onOpenChange,
  onCreated,
}: {
  branchId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (runId: string) => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const { errors, validate, clearField, clearAll, fieldClassName, applyApiErrors } =
    useFormErrors(createPayrollRunSchema);

  const [form, setForm] = useState(() => {
    const now = new Date();
    return {
      year: String(now.getFullYear()),
      month: String(now.getMonth() + 1),
      notes: '',
    };
  });

  useEffect(() => {
    if (!open) {
      const now = new Date();
      setForm({
        year: String(now.getFullYear()),
        month: String(now.getMonth() + 1),
        notes: '',
      });
      clearAll();
    }
  }, [open, clearAll]);

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildPayload>) =>
      apiClient<{ id: string }>('/payroll/runs', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      }),
    onSuccess: async (run) => {
      toast.success('Payroll run created');
      await queryClient.invalidateQueries({ queryKey: queryKeys.payrollRuns(branchId) });
      onOpenChange(false);
      onCreated?.(run.id);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  function buildPayload() {
    return {
      branchId,
      year: Number(form.year),
      month: Number(form.month),
      notes: form.notes.trim() || null,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = buildPayload();
    if (!validate(payload)) return;
    createMutation.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-md gap-0 p-0">
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <CalendarDays className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>New payroll run</DialogTitle>
            <DialogDescription className="mt-1">
              Create a draft run for a branch and period
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

        <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={handleSubmit}>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel label="Year" required />
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={form.year}
                  onChange={(e) => {
                    clearField('year');
                    setForm((prev) => ({ ...prev, year: e.target.value }));
                  }}
                  className={fieldClassName('year', modalFieldClassName)}
                />
                <FormFieldError message={errors.year} />
              </div>
              <div>
                <FormFieldLabel label="Month" required />
                <select
                  value={form.month}
                  onChange={(e) => {
                    clearField('month');
                    setForm((prev) => ({ ...prev, month: e.target.value }));
                  }}
                  className={fieldClassName('month', modalFieldClassName)}
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <FormFieldError message={errors.month} />
              </div>
            </div>
            <div>
              <FormFieldLabel label="Notes" />
              <textarea
                value={form.notes}
                onChange={(e) => {
                  clearField('notes');
                  setForm((prev) => ({ ...prev, notes: e.target.value }));
                }}
                rows={3}
                className={fieldClassName('notes', cn(modalFieldClassName, 'h-auto resize-none'))}
              />
              <FormFieldError message={errors.notes} />
            </div>
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-5 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {createMutation.isPending ? 'Creating…' : 'Create run'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
