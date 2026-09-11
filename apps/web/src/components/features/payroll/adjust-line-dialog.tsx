'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { adjustPayrollLineSchema } from '@eims/shared';
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
import type { PayrollLine } from './types';
import { parsePayrollBreakdown } from './types';

export function AdjustLineDialog({
  branchId,
  line,
  open,
  onOpenChange,
}: {
  branchId: string;
  line: PayrollLine | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [adjustmentsTotal, setAdjustmentsTotal] = useState('');
  const [reason, setReason] = useState('');
  const { errors, validate, clearField, clearAll, fieldClassName, applyApiErrors } =
    useFormErrors(adjustPayrollLineSchema);

  useEffect(() => {
    if (line && open) {
      const breakdown = parsePayrollBreakdown(line.breakdown);
      setAdjustmentsTotal(String(line.adjustmentsTotal ?? 0));
      setReason(breakdown.adjustmentReason ?? '');
      clearAll();
    }
    if (!open) {
      setAdjustmentsTotal('');
      setReason('');
      clearAll();
    }
  }, [line, open, clearAll]);

  const saveMutation = useMutation({
    mutationFn: (payload: { adjustmentsTotal: number; reason: string | null }) => {
      if (!line) throw new Error('No line selected');
      return apiClient(`/payroll/lines/${line.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      toast.success('Adjustment saved');
      if (line) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.payrollRun(line.runId) });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.payrollRuns(branchId) });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!line) return;
    const payload = {
      adjustmentsTotal: Number(adjustmentsTotal) || 0,
      reason: reason.trim() || null,
    };
    if (!validate(payload)) return;
    saveMutation.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-md gap-0 p-0">
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <Pencil className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Adjust payroll line</DialogTitle>
            <DialogDescription className="mt-1">
              {line?.user?.fullName ?? 'Staff member'} — add bonus or deduction adjustment
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
            <div>
              <FormFieldLabel label="Adjustment amount (PKR)" required />
              <input
                type="number"
                value={adjustmentsTotal}
                onChange={(e) => {
                  clearField('adjustmentsTotal');
                  setAdjustmentsTotal(e.target.value);
                }}
                className={fieldClassName('adjustmentsTotal', modalFieldClassName)}
                placeholder="Positive for bonus, negative for deduction"
              />
              <FormFieldError message={errors.adjustmentsTotal} />
            </div>
            <div>
              <FormFieldLabel label="Reason" />
              <textarea
                value={reason}
                onChange={(e) => {
                  clearField('reason');
                  setReason(e.target.value);
                }}
                rows={2}
                className={fieldClassName('reason', cn(modalFieldClassName, 'h-auto resize-none'))}
              />
              <FormFieldError message={errors.reason} />
            </div>
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-5 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={saveMutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending || !line}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save adjustment'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
