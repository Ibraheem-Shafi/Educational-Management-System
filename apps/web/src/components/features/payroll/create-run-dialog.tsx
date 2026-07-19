'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
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
      <DialogContent className="max-w-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle>New payroll run</DialogTitle>
            <DialogDescription className="mt-1">
              Create a draft run for a branch and period
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-[var(--text-sub-500)] hover:bg-neutral-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
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
              className={fieldClassName('notes', cn(modalFieldClassName, 'resize-none'))}
            />
            <FormFieldError message={errors.notes} />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className={cn(
              'w-full rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] px-4 py-2.5 text-sm font-medium text-white',
              createMutation.isPending && 'opacity-50',
            )}
          >
            {createMutation.isPending ? 'Creating…' : 'Create run'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
