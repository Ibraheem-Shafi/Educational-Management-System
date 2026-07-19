'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Receipt, X } from 'lucide-react';
import { toast } from 'sonner';
import { recordPaymentSchema } from '@eims/shared';
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
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { queryKeys } from '@/lib/query-keys';
import { formatCurrency } from '@eims/shared';
import { cn } from '@/lib/utils';

const METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'online', label: 'Online' },
  { value: 'other', label: 'Other' },
];

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: { id: string; netAmount: number; student?: { fullName: string } } | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const { errors, validate, clearField, clearAll, fieldClassName, applyApiErrors } =
    useFormErrors(recordPaymentSchema);

  useEffect(() => {
    if (open && invoice) {
      setAmount(String(invoice.netAmount));
      setMethod('cash');
      clearAll();
    }
    if (!open) {
      setAmount('');
      setMethod('cash');
      clearAll();
    }
  }, [open, invoice, clearAll]);

  const recordMutation = useMutation({
    mutationFn: (payload: { amount: number; method: string }) =>
      apiClient(`/fee-invoices/${invoice!.id}/payments`, {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Payment recorded');
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.feesStats });
      queryClient.invalidateQueries({ queryKey: ['fee-defaulters'] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice) return;
    const payload = {
      amount: Number(amount),
      method: method as 'cash' | 'bank' | 'online' | 'other',
    };
    if (!validate(payload)) return;
    recordMutation.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0 sm:max-w-md" aria-describedby={undefined}>
        <div className="flex items-center justify-between border-b border-stroke-soft-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Receipt className="size-5 text-[var(--text-sub-500)]" />
            <DialogTitle className="text-base font-semibold">Record payment</DialogTitle>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} className="rounded p-1 hover:bg-gray-100">
            <X className="size-4" />
          </button>
        </div>
        <DialogDescription className="sr-only">Record a manual fee payment</DialogDescription>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-5 py-4">
            {invoice?.student && (
              <p className="text-sm text-[var(--text-sub-500)]">Student: {invoice.student.fullName}</p>
            )}

            <div>
              <FormFieldLabel htmlFor="payment-amount">Amount</FormFieldLabel>
              <input
                id="payment-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => {
                  clearField('amount');
                  setAmount(e.target.value);
                }}
                className={fieldClassName('amount', modalFieldClassName)}
              />
              {invoice && (
                <p className="mt-1 text-xs text-[var(--text-sub-500)]">
                  Invoice total: {formatCurrency(invoice.netAmount)}
                </p>
              )}
              <FormFieldError message={errors.amount} />
            </div>

            <div>
              <FormFieldLabel htmlFor="payment-method">Method</FormFieldLabel>
              <SelectDropdown
                aria-label="Payment method"
                value={method}
                onValueChange={(value) => {
                  clearField('method');
                  setMethod(value);
                }}
                options={METHOD_OPTIONS}
                className={fieldClassName('method', modalFieldClassName)}
              />
              <FormFieldError message={errors.method} />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-stroke-soft-200 px-5 py-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-stroke-soft-200 px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!invoice || recordMutation.isPending}
              className={cn(
                'rounded-lg bg-[var(--primary-base,#2563EB)] px-4 py-2 text-sm font-medium text-white',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {recordMutation.isPending ? 'Saving…' : 'Record payment'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
