'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Receipt, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { recordFeePaymentSchema } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { uploadFeePaymentReceipt } from '@/lib/upload-fee-payment-receipt';
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
import { DateField } from '@/components/ui/date-field';
import { todayYmd } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

const METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'online', label: 'Online' },
  { value: 'other', label: 'Other' },
];

function needsReceipt(method: string): boolean {
  return method === 'bank' || method === 'online';
}

export type PaymentDialogMode = 'partial' | 'full';

export type PayInvoiceTarget = {
  id: string;
  netAmount: number;
  remainingAmount?: number;
  student?: { fullName: string };
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice,
  mode = 'partial',
  onPaidInFull,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: PayInvoiceTarget | null;
  mode?: PaymentDialogMode;
  /** Called after a successful payment that clears the remaining balance. */
  onPaidInFull?: () => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(todayYmd());
  const [method, setMethod] = useState('cash');
  const [providerRef, setProviderRef] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const { errors, validate, clearField, clearAll, fieldClassName, applyApiErrors, setFieldError } =
    useFormErrors(recordFeePaymentSchema);

  const remaining = invoice
    ? roundMoney(invoice.remainingAmount ?? invoice.netAmount)
    : 0;
  const isFull = mode === 'full';
  const showReceiptFields = needsReceipt(method);

  useEffect(() => {
    if (open && invoice) {
      const rem = roundMoney(invoice.remainingAmount ?? invoice.netAmount);
      setAmount(String(rem));
      setPaidAt(todayYmd());
      setMethod('cash');
      setProviderRef('');
      setReceiptFile(null);
      setAmountError(null);
      clearAll();
    }
    if (!open) {
      setAmount('');
      setPaidAt(todayYmd());
      setMethod('cash');
      setProviderRef('');
      setReceiptFile(null);
      setAmountError(null);
      clearAll();
    }
  }, [open, invoice, clearAll]);

  const recordMutation = useMutation({
    mutationFn: async (payload: {
      amount: number;
      method: string;
      paidAt: string;
      providerRef?: string;
      receipt?: {
        storagePath: string;
        fileName: string;
        mimeType?: string;
        sizeBytes?: number;
      };
    }) => {
      let receipt = payload.receipt;
      if (needsReceipt(payload.method)) {
        if (!receiptFile) {
          throw new Error('Payment receipt is required for bank transfer and online payments');
        }
        if (!token) throw new Error('Not authenticated');
        const uploaded = await uploadFeePaymentReceipt(receiptFile, invoice!.id, token);
        receipt = {
          storagePath: uploaded.path,
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
        };
      }

      return apiClient<{
        payment: { id: string };
        invoice?: { status?: { code?: string } };
      }>(`/fee-invoices/${invoice!.id}/payments`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          amount: payload.amount,
          method: payload.method,
          paidAt: payload.paidAt,
          ...(payload.providerRef ? { providerRef: payload.providerRef } : {}),
          ...(receipt ? { receipt } : {}),
        }),
      });
    },
    onSuccess: (result, variables) => {
      const paidInFull =
        result?.invoice?.status?.code === 'paid' ||
        roundMoney(variables.amount) >= remaining;
      toast.success(paidInFull ? 'Invoice paid in full' : 'Payment recorded');
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fee-invoices-completed'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.feesStats });
      queryClient.invalidateQueries({ queryKey: ['fee-defaulters'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.reportsFeeDefaulters() });
      queryClient.invalidateQueries({ queryKey: queryKeys.feesRevenueTrend });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardMonthlyRevenue });
      queryClient.invalidateQueries({ queryKey: queryKeys.reportsOverview });
      queryClient.invalidateQueries({ queryKey: queryKeys.portalStudentFees() });
      queryClient.invalidateQueries({ queryKey: queryKeys.portalParentFees() });
      queryClient.invalidateQueries({ queryKey: queryKeys.portalStudentStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.portalParentStats });
      onOpenChange(false);
      if (paidInFull) onPaidInFull?.();
      if (result?.payment?.id) {
        window.open(`/print/fee-receipts/${result.payment.id}`, '_blank');
      }
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) {
      setFieldError('paidAt', 'Paid date is required');
      return;
    }

    const numericAmount = roundMoney(Number(amount));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setAmountError('Amount must be greater than 0');
      return;
    }
    if (numericAmount > remaining) {
      setAmountError(`Amount cannot exceed remaining balance (${formatCurrency(remaining)})`);
      return;
    }
    setAmountError(null);

    if (needsReceipt(method) && !receiptFile) {
      setFieldError('receipt', 'Payment receipt is required');
      return;
    }

    const trimmedRef = providerRef.trim();
    const payload = {
      amount: isFull ? remaining : numericAmount,
      method: method as 'cash' | 'bank' | 'online' | 'other',
      paidAt,
      ...(trimmedRef ? { providerRef: trimmedRef } : {}),
      // Placeholder so schema refine passes before upload; real path set in mutation
      ...(needsReceipt(method) && receiptFile
        ? {
            receipt: {
              storagePath: 'pending',
              fileName: receiptFile.name,
              mimeType: receiptFile.type || undefined,
              sizeBytes: receiptFile.size || undefined,
            },
          }
        : {}),
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
            <DialogTitle className="text-base font-semibold">
              {isFull ? 'Pay in full' : 'Record payment'}
            </DialogTitle>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} className="rounded p-1 hover:bg-gray-100">
            <X className="size-4" />
          </button>
        </div>
        <DialogDescription className="sr-only">
          {isFull ? 'Pay remaining fee balance in full' : 'Record a manual fee payment'}
        </DialogDescription>

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
                min="0.01"
                max={remaining}
                step="0.01"
                value={amount}
                disabled={isFull}
                onChange={(e) => {
                  clearField('amount');
                  setAmountError(null);
                  setAmount(e.target.value);
                }}
                className={fieldClassName(
                  'amount',
                  cn(modalFieldClassName, isFull && 'opacity-60'),
                )}
              />
              {invoice && (
                <p className="mt-1 text-xs text-[var(--text-sub-500)]">
                  Remaining: {formatCurrency(remaining)}
                  {invoice.netAmount !== remaining
                    ? ` · Invoice total: ${formatCurrency(invoice.netAmount)}`
                    : null}
                </p>
              )}
              <FormFieldError message={amountError ?? errors.amount} />
            </div>

            <div>
              <FormFieldLabel htmlFor="payment-paid-at" required>
                Paid date
              </FormFieldLabel>
              <DateField
                id="payment-paid-at"
                value={paidAt}
                onValueChange={(value) => {
                  clearField('paidAt');
                  setPaidAt(value);
                }}
                confirmTitle="Backdated payment"
                confirmDescription="Use this only if the money was received on an earlier day, not today."
                className={fieldClassName('paidAt', modalFieldClassName)}
              />
              <FormFieldError message={errors.paidAt} />
            </div>

            <div>
              <FormFieldLabel htmlFor="payment-method">Method</FormFieldLabel>
              <SelectDropdown
                aria-label="Payment method"
                value={method}
                onValueChange={(value) => {
                  clearField('method');
                  clearField('receipt');
                  setMethod(value);
                  if (!needsReceipt(value)) {
                    setProviderRef('');
                    setReceiptFile(null);
                  }
                }}
                options={METHOD_OPTIONS}
                fullWidth
                className={cn('w-full', errors.method && '[&_button]:border-red-500')}
              />
              <FormFieldError message={errors.method} />
            </div>

            {showReceiptFields ? (
              <>
                <div>
                  <FormFieldLabel htmlFor="payment-provider-ref">
                    Transaction reference
                  </FormFieldLabel>
                  <input
                    id="payment-provider-ref"
                    type="text"
                    value={providerRef}
                    placeholder="UTR / transaction ID"
                    onChange={(e) => {
                      clearField('providerRef');
                      setProviderRef(e.target.value);
                    }}
                    className={fieldClassName('providerRef', modalFieldClassName)}
                  />
                  <FormFieldError message={errors.providerRef} />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <FormFieldLabel required>Payment receipt</FormFieldLabel>
                    <button
                      type="button"
                      disabled={recordMutation.isPending}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-md border border-stroke-soft-200 px-2.5 py-1 text-sm text-[var(--text-sub-500)] hover:bg-neutral-50"
                    >
                      <Upload className="h-4 w-4" />
                      {receiptFile ? 'Change file' : 'Attach screenshot'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf"
                      onChange={(e) => {
                        clearField('receipt');
                        setReceiptFile(e.target.files?.[0] ?? null);
                        e.target.value = '';
                      }}
                    />
                  </div>
                  {receiptFile ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-stroke-soft-200 bg-neutral-50 px-3 py-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <Paperclip className="h-4 w-4 shrink-0 text-[var(--text-sub-500)]" />
                        <span className="truncate">{receiptFile.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptFile(null);
                          clearField('receipt');
                        }}
                        className="rounded-md p-1 text-[var(--text-sub-500)] hover:bg-white"
                        aria-label="Remove receipt"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-sub-500)]">
                      Upload a transfer screenshot or PDF receipt
                    </p>
                  )}
                  <FormFieldError message={errors.receipt} />
                </div>
              </>
            ) : null}
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
              disabled={!invoice || remaining <= 0 || recordMutation.isPending}
              className={cn(
                'rounded-lg bg-[var(--institution-primary)] px-4 py-2 text-sm font-medium text-white',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {recordMutation.isPending
                ? 'Saving…'
                : isFull
                  ? 'Pay in full'
                  : 'Record payment'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
