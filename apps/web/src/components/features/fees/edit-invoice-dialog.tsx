'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt, X } from 'lucide-react';
import { toast } from 'sonner';
import { updateFeeInvoiceSchema } from '@eims/shared';
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
import { DateField } from '@/components/ui/date-field';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

interface InvoiceDetail {
  id: string;
  amount: number;
  discount: number;
  fine: number;
  netAmount: number;
  dueDate: string | null;
  billingPeriod: string | null;
  voucherNo: string | null;
  remarks: string | null;
  student?: { fullName: string };
  paidAmount?: number;
  remainingAmount?: number;
}

export function EditInvoiceDialog({
  open,
  onOpenChange,
  invoiceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const { errors, validate, clearField, applyApiErrors, fieldClassName } =
    useFormErrors(updateFeeInvoiceSchema);

  const [amount, setAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [fine, setFine] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [billingPeriod, setBillingPeriod] = useState('');
  const [voucherNo, setVoucherNo] = useState('');
  const [remarks, setRemarks] = useState('');

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['fee-invoice', invoiceId],
    queryFn: () => apiClient<InvoiceDetail>(`/fee-invoices/${invoiceId}`, { token }),
    enabled: open && !!token && !!invoiceId,
  });

  useEffect(() => {
    if (!invoice || !open) return;
    setAmount(String(invoice.amount ?? ''));
    setDiscount(String(invoice.discount ?? 0));
    setFine(String(invoice.fine ?? 0));
    setDueDate(invoice.dueDate ? invoice.dueDate.slice(0, 10) : '');
    setBillingPeriod(invoice.billingPeriod ?? '');
    setVoucherNo(invoice.voucherNo ?? '');
    setRemarks(invoice.remarks ?? '');
  }, [invoice, open]);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient<{ cascadedCount?: number }>(`/fee-invoices/${invoiceId}`, {
        method: 'PATCH',
        token,
        body,
      }),
    onSuccess: (result) => {
      const cascaded = result?.cascadedCount ?? 0;
      toast.success(
        cascaded > 0
          ? `Invoice updated · discount applied to ${cascaded} later month${cascaded === 1 ? '' : 's'}`
          : 'Invoice updated',
      );
      void queryClient.invalidateQueries({ queryKey: ['fee-invoices-by-student'] });
      void queryClient.invalidateQueries({ queryKey: ['fee-invoices-student'] });
      void queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['fee-invoices-completed'] });
      void queryClient.invalidateQueries({ queryKey: ['fee-invoice'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.feesStats });
      void queryClient.invalidateQueries({ queryKey: ['fee-defaulters'] });
      void queryClient.invalidateQueries({ queryKey: ['reports-fee-defaulters'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reportsFeeDefaulters() });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message || 'Failed to update invoice');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      amount: Number(amount),
      discount: discount === '' ? 0 : Number(discount),
      fine: fine === '' ? 0 : Number(fine),
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000Z`).toISOString() : null,
      billingPeriod: billingPeriod.trim() || null,
      voucherNo: voucherNo.trim() || undefined,
      remarks: remarks.trim() || undefined,
    };
    if (!validate(payload)) return;
    mutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[calc(100vh-2rem)] gap-0 p-0 sm:max-w-md"
        aria-describedby={undefined}
      >
        <div className="flex w-full flex-col">
          <div className="flex items-start justify-between border-b border-[var(--stroke-soft-200,#E2E4E9)] px-5 py-4">
            <div>
              <DialogTitle className="text-base font-semibold">Edit invoice</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-[var(--text-sub-500,#525866)]">
                {invoice?.student?.fullName
                  ? `Adjust amounts for ${invoice.student.fullName}`
                  : 'Adjust amount, discount, fine, and due date'}
              </DialogDescription>
            </div>
            <button
              type="button"
              className="rounded-md p-1 text-[var(--text-sub-500,#525866)] hover:bg-[var(--neutral-50)]"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto px-5 py-4">
            {isLoading ? (
              <p className="text-sm text-[var(--text-sub-500,#525866)]">Loading invoice…</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FormFieldLabel required>Amount</FormFieldLabel>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={fieldClassName('amount', modalFieldClassName)}
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        clearField('amount');
                      }}
                    />
                    <FormFieldError message={errors.amount} />
                  </div>
                  <div>
                    <FormFieldLabel>Discount</FormFieldLabel>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={fieldClassName('discount', modalFieldClassName)}
                      value={discount}
                      onChange={(e) => {
                        setDiscount(e.target.value);
                        clearField('discount');
                      }}
                    />
                    <FormFieldError message={errors.discount} />
                  </div>
                  <div>
                    <FormFieldLabel>Fine</FormFieldLabel>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={fieldClassName('fine', modalFieldClassName)}
                      value={fine}
                      onChange={(e) => {
                        setFine(e.target.value);
                        clearField('fine');
                      }}
                    />
                    <FormFieldError message={errors.fine} />
                  </div>
                  <div>
                    <FormFieldLabel>Billing period</FormFieldLabel>
                    <input
                      type="month"
                      className={fieldClassName('billingPeriod', modalFieldClassName)}
                      value={billingPeriod}
                      onChange={(e) => {
                        setBillingPeriod(e.target.value);
                        clearField('billingPeriod');
                      }}
                    />
                    <FormFieldError message={errors.billingPeriod} />
                  </div>
                </div>
                <div>
                  <FormFieldLabel>Due date</FormFieldLabel>
                  <DateField
                    value={dueDate}
                    onValueChange={(v) => {
                      setDueDate(v);
                      clearField('dueDate');
                    }}
                    confirmPast={false}
                    className={fieldClassName('dueDate', modalFieldClassName)}
                  />
                  <FormFieldError message={errors.dueDate} />
                </div>
                <div>
                  <FormFieldLabel>Voucher no</FormFieldLabel>
                  <input
                    className={fieldClassName('voucherNo', modalFieldClassName)}
                    value={voucherNo}
                    onChange={(e) => {
                      setVoucherNo(e.target.value);
                      clearField('voucherNo');
                    }}
                  />
                  <FormFieldError message={errors.voucherNo} />
                </div>
                <div>
                  <FormFieldLabel>Remarks</FormFieldLabel>
                  <textarea
                    className={cn(fieldClassName('remarks', modalFieldClassName), 'min-h-[72px]')}
                    value={remarks}
                    onChange={(e) => {
                      setRemarks(e.target.value);
                      clearField('remarks');
                    }}
                  />
                  <FormFieldError message={errors.remarks} />
                </div>
                <p className="text-xs text-[var(--text-sub-500,#525866)]">
                  Changing discount also updates later months for this student and fee type (skips
                  months where paid amount would exceed the new net). For monthly fees, the student’s
                  recurring monthly discount is updated too. Net cannot go below amount already paid
                  on this invoice.
                </p>
              </>
            )}

            <div className="flex justify-end gap-2 border-t border-[var(--stroke-soft-200,#E2E4E9)] pt-4">
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white px-3 text-sm font-medium"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutation.isPending || isLoading || !invoiceId}
                className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-midnight-blue-950 px-3 text-sm font-medium text-white disabled:opacity-60"
              >
                <Receipt className="h-4 w-4" />
                {mutation.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
