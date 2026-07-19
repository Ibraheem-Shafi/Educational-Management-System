'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { createVoucherSchema, voucherTypes } from '@eims/shared';
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
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AccountingAccount, JournalVoucher } from './types';
import { formatLabel, formatMoney } from './types';

type LineForm = { accountId: string; debit: string; credit: string; memo: string };

const emptyLine = (): LineForm => ({ accountId: '', debit: '', credit: '', memo: '' });

export function VoucherDialog({
  open,
  onOpenChange,
  branchId,
  mode,
  voucher,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  mode: 'create' | 'view';
  voucher?: JournalVoucher | null;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const isView = mode === 'view';
  const { errors, validate, clearField, clearAll, fieldClassName, applyApiErrors } =
    useFormErrors(createVoucherSchema);

  const [voucherType, setVoucherType] = useState('journal');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState('');
  const [lines, setLines] = useState<LineForm[]>([emptyLine(), emptyLine()]);

  const { data: accountsData } = useQuery({
    queryKey: queryKeys.accountingAccounts(branchId),
    queryFn: () =>
      apiClient<{ data: AccountingAccount[] }>(
        `/accounting/accounts?branchId=${branchId}&activeOnly=true&limit=100`,
        { token },
      ),
    enabled: !!token && !!branchId && open,
  });

  const accountOptions = useMemo(
    () =>
      (accountsData?.data ?? []).map((a) => ({
        value: a.id,
        label: `${a.code} — ${a.name}`,
      })),
    [accountsData],
  );

  useEffect(() => {
    if (!open) return;
    if (isView && voucher) {
      setVoucherType(voucher.voucherType);
      setVoucherDate(voucher.voucherDate);
      setNarration(voucher.narration ?? '');
      setLines(
        voucher.lines.map((line) => ({
          accountId: line.accountId,
          debit: line.debit ? String(line.debit) : '',
          credit: line.credit ? String(line.credit) : '',
          memo: line.memo ?? '',
        })),
      );
      return;
    }
    setVoucherType('journal');
    setVoucherDate(new Date().toISOString().slice(0, 10));
    setNarration('');
    setLines([emptyLine(), emptyLine()]);
    clearAll();
  }, [open, isView, voucher, clearAll]);

  const totals = useMemo(() => {
    const debit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
    const credit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.001 && debit > 0 };
  }, [lines]);

  const mutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof buildPayload>) =>
      apiClient('/accounting/vouchers', { method: 'POST', token, body: payload }),
    onSuccess: async () => {
      toast.success('Voucher created');
      await queryClient.invalidateQueries({ queryKey: queryKeys.accountingVouchers(branchId) });
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
      voucherType,
      voucherDate,
      narration: narration.trim() || undefined,
      lines: lines.map((line) => ({
        accountId: line.accountId,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        memo: line.memo.trim() || undefined,
      })),
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isView) return;
    const payload = buildPayload();
    if (!validate(payload)) return;
    mutation.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <div className="flex items-center justify-between border-b border-stroke-soft-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-icon-primary" />
            <DialogTitle className="text-base font-medium">
              {isView ? voucher?.voucherNo ?? 'Voucher' : 'New journal voucher'}
            </DialogTitle>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Close">
            <X className="h-5 w-5 text-icon-primary" />
          </button>
        </div>
        <DialogDescription className="sr-only">Journal voucher form</DialogDescription>

        <form className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <FormFieldLabel>Type</FormFieldLabel>
              <SelectDropdown
                aria-label="Voucher type"
                value={voucherType}
                onValueChange={(value) => {
                  if (isView) return;
                  clearField('voucherType');
                  setVoucherType(value);
                }}
                options={voucherTypes.map((t) => ({ value: t, label: formatLabel(t) }))}
                className={cn(
                  fieldClassName('voucherType', 'w-full'),
                  isView && 'pointer-events-none opacity-60',
                )}
              />
              <FormFieldError message={errors.voucherType} />
            </div>
            <div>
              <FormFieldLabel htmlFor="voucher-date">Date</FormFieldLabel>
              <input
                id="voucher-date"
                type="date"
                className={fieldClassName('voucherDate', modalFieldClassName)}
                value={voucherDate}
                disabled={isView}
                onChange={(e) => {
                  clearField('voucherDate');
                  setVoucherDate(e.target.value);
                }}
              />
              <FormFieldError message={errors.voucherDate} />
            </div>
            <div>
              <FormFieldLabel>Status</FormFieldLabel>
              <input
                className={modalFieldClassName}
                value={isView ? formatLabel(voucher?.status ?? '') : 'Draft'}
                disabled
              />
            </div>
          </div>

          <div>
            <FormFieldLabel htmlFor="voucher-narration">Narration</FormFieldLabel>
            <input
              id="voucher-narration"
              className={fieldClassName('narration', modalFieldClassName)}
              value={narration}
              disabled={isView}
              onChange={(e) => {
                clearField('narration');
                setNarration(e.target.value);
              }}
              placeholder="Optional description"
            />
            <FormFieldError message={errors.narration} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <FormFieldLabel>Lines</FormFieldLabel>
              {!isView ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setLines((prev) => [...prev, emptyLine()])}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add line
                </Button>
              ) : null}
            </div>
            <FormFieldError message={errors.lines} />

            {lines.map((line, index) => (
              <div key={index} className="grid gap-2 rounded-lg border border-stroke-soft-200 p-3 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <SelectDropdown
                    aria-label={`Account line ${index + 1}`}
                    placeholder="Select account"
                    value={line.accountId}
                    onValueChange={(value) => {
                      if (isView) return;
                      clearField(`lines.${index}.accountId`);
                      setLines((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, accountId: value } : item)),
                      );
                    }}
                    options={accountOptions}
                    className={cn(
                      fieldClassName(`lines.${index}.accountId`, 'w-full'),
                      isView && 'pointer-events-none opacity-60',
                    )}
                  />
                  <FormFieldError message={errors[`lines.${index}.accountId`]} />
                </div>
                <div className="sm:col-span-2">
                  <input
                    className={fieldClassName(`lines.${index}.debit`, modalFieldClassName)}
                    placeholder="Debit"
                    value={line.debit}
                    disabled={isView}
                    onChange={(e) => {
                      clearField(`lines.${index}.debit`);
                      setLines((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, debit: e.target.value, credit: e.target.value ? '' : item.credit } : item,
                        ),
                      );
                    }}
                  />
                  <FormFieldError message={errors[`lines.${index}.debit`]} />
                </div>
                <div className="sm:col-span-2">
                  <input
                    className={fieldClassName(`lines.${index}.credit`, modalFieldClassName)}
                    placeholder="Credit"
                    value={line.credit}
                    disabled={isView}
                    onChange={(e) => {
                      clearField(`lines.${index}.credit`);
                      setLines((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, credit: e.target.value, debit: e.target.value ? '' : item.debit } : item,
                        ),
                      );
                    }}
                  />
                  <FormFieldError message={errors[`lines.${index}.credit`]} />
                </div>
                <div className="sm:col-span-2">
                  <input
                    className={fieldClassName(`lines.${index}.memo`, modalFieldClassName)}
                    placeholder="Memo"
                    value={line.memo}
                    disabled={isView}
                    onChange={(e) => {
                      clearField(`lines.${index}.memo`);
                      setLines((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, memo: e.target.value } : item)),
                      );
                    }}
                  />
                  <FormFieldError message={errors[`lines.${index}.memo`]} />
                </div>
                {!isView && lines.length > 2 ? (
                  <div className="flex items-center justify-end sm:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Remove line"
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}

            <p className={cn('text-sm', totals.balanced ? 'text-green-700' : 'text-amber-700')}>
              Debit PKR {formatMoney(totals.debit)} · Credit PKR {formatMoney(totals.credit)}
              {!totals.balanced ? ' — must balance' : ''}
            </p>
          </div>

          {!isView ? (
            <button
              type="submit"
              disabled={mutation.isPending || !totals.balanced}
              className={cn(
                'w-full rounded-lg bg-primary-base px-4 py-2.5 text-sm font-medium text-neutral-0',
                (mutation.isPending || !totals.balanced) && 'opacity-60',
              )}
            >
              {mutation.isPending ? 'Saving…' : 'Create draft voucher'}
            </button>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
