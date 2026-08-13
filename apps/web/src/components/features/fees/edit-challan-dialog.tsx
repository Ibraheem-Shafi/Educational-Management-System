'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { FEE_CHALLAN_LINE_CODES, updateFeeChallanSchema } from '@eims/shared';
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
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { DateField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';

export interface EditableChallanLine {
  code: string;
  label: string;
  amount: number;
  sortOrder?: number;
  feeInvoiceId?: string | null;
}

export interface EditableChallan {
  id: string;
  challanNo: string | null;
  billingPeriod: string;
  dueDate: string | null;
  sessionLabel: string | null;
  paidAmount: number;
  student?: { fullName: string } | null;
  lines?: EditableChallanLine[];
}

type LineDraft = {
  code: (typeof FEE_CHALLAN_LINE_CODES)[number];
  label: string;
  amount: string;
};

const lineCodeOptions = FEE_CHALLAN_LINE_CODES.map((code) => ({
  value: code,
  label: code.charAt(0).toUpperCase() + code.slice(1),
}));

export function EditChallanDialog({
  open,
  onOpenChange,
  challan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challan: EditableChallan | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const { errors, validate, clearField, applyApiErrors, fieldClassName } =
    useFormErrors(updateFeeChallanSchema);

  const [dueDate, setDueDate] = useState('');
  const [sessionLabel, setSessionLabel] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);

  useEffect(() => {
    if (!challan || !open) return;
    setDueDate(challan.dueDate ? challan.dueDate.slice(0, 10) : '');
    setSessionLabel(challan.sessionLabel ?? '');
    setLines(
      (challan.lines ?? []).map((l) => ({
        code: (FEE_CHALLAN_LINE_CODES.includes(l.code as (typeof FEE_CHALLAN_LINE_CODES)[number])
          ? l.code
          : 'monthly') as (typeof FEE_CHALLAN_LINE_CODES)[number],
        label: l.label,
        amount: String(l.amount ?? 0),
      })),
    );
  }, [challan, open]);

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient(`/fee-challans/${challan!.id}`, {
        method: 'PATCH',
        token,
        body,
      }),
    onSuccess: () => {
      toast.success('Challan updated');
      queryClient.invalidateQueries({ queryKey: ['fee-challans'] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message || 'Failed to update challan');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!challan) return;
    const payload = {
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000Z`).toISOString() : null,
      sessionLabel: sessionLabel.trim() || undefined,
      lines: lines.map((l, idx) => ({
        code: l.code,
        label: l.label.trim() || l.code,
        amount: Number(l.amount || 0),
        sortOrder: idx,
      })),
    };
    if (!validate(payload)) return;
    mutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[calc(100vh-2rem)] gap-0 p-0 sm:max-w-lg"
        aria-describedby={undefined}
      >
        <div className="flex w-full flex-col">
          <div className="flex items-start justify-between border-b border-[var(--stroke-soft-200,#E2E4E9)] px-5 py-4">
            <div>
              <DialogTitle className="text-base font-semibold">Edit challan</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-[var(--text-sub-500,#525866)]">
                {challan
                  ? `${challan.challanNo ?? 'Challan'} · ${challan.billingPeriod}${
                      challan.student?.fullName ? ` · ${challan.student.fullName}` : ''
                    }`
                  : 'Update line items and due date'}
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
            <div className="grid grid-cols-2 gap-3">
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
                <FormFieldLabel>Session label</FormFieldLabel>
                <input
                  className={fieldClassName('sessionLabel', modalFieldClassName)}
                  placeholder="e.g. 2025-2026"
                  value={sessionLabel}
                  onChange={(e) => {
                    setSessionLabel(e.target.value);
                    clearField('sessionLabel');
                  }}
                />
                <FormFieldError message={errors.sessionLabel} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormFieldLabel>Lines</FormFieldLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 px-2"
                  onClick={() =>
                    setLines((prev) => [...prev, { code: 'monthly', label: 'Monthly', amount: '0' }])
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add line
                </Button>
              </div>
              {lines.length === 0 ? (
                <p className="text-sm text-[var(--text-sub-500,#525866)]">Add at least one line.</p>
              ) : (
                lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_1.2fr_0.8fr_auto] items-end gap-2 rounded-lg border border-[var(--stroke-soft-200,#E2E4E9)] p-2"
                  >
                    <div>
                      <FormFieldLabel>Code</FormFieldLabel>
                      <SelectDropdown
                        fullWidth
                        aria-label="Line code"
                        value={line.code}
                        onValueChange={(value) => {
                          setLines((prev) =>
                            prev.map((l, i) =>
                              i === idx
                                ? {
                                    ...l,
                                    code: value as (typeof FEE_CHALLAN_LINE_CODES)[number],
                                    label: l.label || value,
                                  }
                                : l,
                            ),
                          );
                        }}
                        options={lineCodeOptions}
                      />
                    </div>
                    <div>
                      <FormFieldLabel>Label</FormFieldLabel>
                      <input
                        className={modalFieldClassName}
                        value={line.label}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l, i) => (i === idx ? { ...l, label: e.target.value } : l)),
                          )
                        }
                      />
                    </div>
                    <div>
                      <FormFieldLabel>Amount</FormFieldLabel>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={modalFieldClassName}
                        value={line.amount}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l, i) => (i === idx ? { ...l, amount: e.target.value } : l)),
                          )
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-red-600 hover:bg-red-50"
                      aria-label="Remove line"
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
              <FormFieldError message={errors.lines} />
              {challan && challan.paidAmount > 0 ? (
                <p className="text-xs text-[var(--text-sub-500,#525866)]">
                  Paid so far: {challan.paidAmount}. Total cannot go below this amount.
                </p>
              ) : null}
            </div>

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
                disabled={mutation.isPending || !challan || lines.length === 0}
                className="inline-flex h-9 items-center rounded-[10px] bg-midnight-blue-950 px-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {mutation.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
