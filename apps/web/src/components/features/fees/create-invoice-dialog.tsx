'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt, X } from 'lucide-react';
import { toast } from 'sonner';
import { createFeeInvoiceSchema } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { FormFieldError } from '@/components/forms/form-field-error';
import type { PaginatedResponse } from '@eims/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

interface Student {
  id: string;
  fullName: string;
}

interface FeeType {
  id: string;
  name: string;
}

const emptyForm = {
  studentId: '',
  feeTypeId: '',
  amount: '',
  discount: '',
  fine: '',
  dueDate: '',
};

export function CreateInvoiceDialog({
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
  const { errors, validate, clearField, clearAll, fieldClassName, applyApiErrors } =
    useFormErrors(createFeeInvoiceSchema);

  const { data: students } = useQuery({
    queryKey: ['students-fees'],
    queryFn: () => apiClient<PaginatedResponse<Student>>('/students?limit=100', { token }),
    enabled: !!token && open,
  });

  const { data: feeTypes } = useQuery({
    queryKey: ['fee-types'],
    queryFn: () => apiClient<{ data: FeeType[] }>('/fee-types', { token }),
    enabled: !!token && open,
  });

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      clearAll();
    }
  }, [open, clearAll]);

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildPayload>) =>
      apiClient('/fee-invoices', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Invoice created');
      queryClient.invalidateQueries({ queryKey: ['fee-invoices'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.feesStats });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  function buildPayload() {
    return {
      branchId,
      studentId: form.studentId,
      feeTypeId: form.feeTypeId,
      amount: Number(form.amount),
      ...(form.discount ? { discount: Number(form.discount) } : {}),
      ...(form.fine ? { fine: Number(form.fine) } : {}),
      ...(form.dueDate ? { dueDate: new Date(form.dueDate).toISOString() } : {}),
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
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <Receipt className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Create invoice</DialogTitle>
            <DialogDescription className="mt-1">Issue a new fee invoice for a student</DialogDescription>
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
              <FormFieldLabel required>Student</FormFieldLabel>
              <SelectDropdown
                aria-label="Student"
                placeholder="Select student"
                value={form.studentId}
                onValueChange={(value) => {
                  clearField('studentId');
                  setForm((prev) => ({ ...prev, studentId: value }));
                }}
                options={[
                  { value: '', label: 'Select student' },
                  ...(students?.data.map((s) => ({ value: s.id, label: s.fullName })) ?? []),
                ]}
                className={fieldClassName('studentId', 'w-full')}
              />
              <FormFieldError message={errors.studentId} />
            </div>

            <div>
              <FormFieldLabel required>Fee type</FormFieldLabel>
              <SelectDropdown
                aria-label="Fee type"
                placeholder="Select fee type"
                value={form.feeTypeId}
                onValueChange={(value) => {
                  clearField('feeTypeId');
                  setForm((prev) => ({ ...prev, feeTypeId: value }));
                }}
                options={[
                  { value: '', label: 'Select fee type' },
                  ...(feeTypes?.data.map((f) => ({ value: f.id, label: f.name })) ?? []),
                ]}
                className={fieldClassName('feeTypeId', 'w-full')}
              />
              <FormFieldError message={errors.feeTypeId} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel required>Amount (PKR)</FormFieldLabel>
                <input
                  type="number"
                  className={fieldClassName('amount', modalFieldClassName)}
                  placeholder="Amount (PKR)"
                  value={form.amount}
                  onChange={(e) => {
                    clearField('amount');
                    setForm((prev) => ({ ...prev, amount: e.target.value }));
                  }}
                />
                <FormFieldError message={errors.amount} />
              </div>
              <div>
                <FormFieldLabel>Discount</FormFieldLabel>
                <input
                  type="number"
                  className={fieldClassName('discount', modalFieldClassName)}
                  placeholder="Discount"
                  value={form.discount}
                  onChange={(e) => {
                    clearField('discount');
                    setForm((prev) => ({ ...prev, discount: e.target.value }));
                  }}
                />
                <FormFieldError message={errors.discount} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel>Late fine</FormFieldLabel>
                <input
                  type="number"
                  className={fieldClassName('fine', modalFieldClassName)}
                  placeholder="Late fine"
                  value={form.fine}
                  onChange={(e) => {
                    clearField('fine');
                    setForm((prev) => ({ ...prev, fine: e.target.value }));
                  }}
                />
                <FormFieldError message={errors.fine} />
              </div>
              <div>
                <FormFieldLabel>Due date</FormFieldLabel>
                <input
                  type="date"
                  className={fieldClassName('dueDate', modalFieldClassName)}
                  value={form.dueDate}
                  onChange={(e) => {
                    clearField('dueDate');
                    setForm((prev) => ({ ...prev, dueDate: e.target.value }));
                  }}
                />
                <FormFieldError message={errors.dueDate} />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
              )}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {createMutation.isPending ? 'Creating…' : 'Create invoice'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
