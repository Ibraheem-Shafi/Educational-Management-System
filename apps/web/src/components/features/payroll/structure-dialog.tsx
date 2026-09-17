'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  createSalaryStructureSchema,
  DEFAULT_EXTRA_LEC_RATE,
  updateSalaryStructureSchema,
} from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { useUsersOptions } from '@/hooks/use-users-options';
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
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import type { SalaryStructure, StaffGroup } from './types';

const GROUP_OPTIONS: Array<{ value: StaffGroup; label: string }> = [
  { value: 'permanent', label: 'Permanent staff' },
  { value: 'admin', label: 'Admin staff' },
  { value: 'visiting', label: 'Visiting staff' },
];

export function StructureDialog({
  branchId,
  userId,
  structure,
  open,
  onOpenChange,
}: {
  branchId: string;
  userId?: string;
  structure?: SalaryStructure;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const isEdit = !!structure;
  const { errors, validate, clearField, clearAll, fieldClassName, applyApiErrors } = useFormErrors(
    isEdit ? updateSalaryStructureSchema : createSalaryStructureSchema,
  );

  const [form, setForm] = useState({
    userId: userId ?? '',
    basicSalary: '',
    staffGroup: 'permanent' as StaffGroup,
    bankAccount: '',
    eobi: '0',
    pessi: '0',
    extraLecRate: String(DEFAULT_EXTRA_LEC_RATE),
    ratePerClass: '0',
    effectiveFrom: '',
    effectiveTo: '',
    isActive: true,
  });

  useEffect(() => {
    if (!open) return;
    if (structure) {
      setForm({
        userId: structure.userId,
        basicSalary: String(structure.basicSalary),
        staffGroup: structure.staffGroup ?? 'permanent',
        bankAccount: structure.bankAccount ?? '',
        eobi: String(structure.eobi ?? 0),
        pessi: String(structure.pessi ?? 0),
        extraLecRate: String(structure.extraLecRate ?? DEFAULT_EXTRA_LEC_RATE),
        ratePerClass: String(structure.ratePerClass ?? 0),
        effectiveFrom: structure.effectiveFrom,
        effectiveTo: structure.effectiveTo ?? '',
        isActive: structure.isActive,
      });
      return;
    }
    setForm({
      userId: userId ?? '',
      basicSalary: '',
      staffGroup: 'permanent',
      bankAccount: '',
      eobi: '0',
      pessi: '0',
      extraLecRate: String(DEFAULT_EXTRA_LEC_RATE),
      ratePerClass: '0',
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: '',
      isActive: true,
    });
    clearAll();
  }, [open, structure, userId, clearAll]);

  const { data: users } = useUsersOptions(token, branchId, {
    enabled: open && !userId,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => {
      if (isEdit && structure) {
        return apiClient(`/payroll/structures/${structure.id}`, {
          method: 'PATCH',
          token,
          body: payload,
        });
      }
      return apiClient('/payroll/structures', {
        method: 'POST',
        token,
        body: payload,
      });
    },
    onSuccess: async () => {
      toast.success(isEdit ? 'Salary card updated' : 'Salary card saved');
      await queryClient.invalidateQueries({ queryKey: queryKeys.payrollStructures(branchId) });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const staffOptions = (users?.data ?? []).map((u) => ({
    value: u.id,
    label: u.staffCode ? `${u.fullName} (${u.staffCode})` : u.fullName,
  }));

  function buildPayload() {
    const shared = {
      basicSalary: Number(form.basicSalary) || 0,
      staffGroup: form.staffGroup,
      bankAccount: form.bankAccount.trim() || null,
      eobi: Number(form.eobi) || 0,
      pessi: Number(form.pessi) || 0,
      extraLecRate: Number(form.extraLecRate) || DEFAULT_EXTRA_LEC_RATE,
      ratePerClass: Number(form.ratePerClass) || 0,
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || null,
      isActive: form.isActive,
      components: [] as Array<never>,
    };
    if (isEdit) return shared;
    return { ...shared, userId: form.userId, branchId };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = buildPayload();
    if (!validate(payload)) return;
    saveMutation.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-lg gap-0 p-0">
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <Wallet className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>{isEdit ? 'Edit salary card' : 'Add salary card'}</DialogTitle>
            <DialogDescription className="mt-1">
              Basic pay, group, bank account, and default EOBI/PESSI for the monthly sheet
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

        <form className="flex min-h-0 flex-1 flex-col overflow-hidden" noValidate onSubmit={handleSubmit}>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            {!isEdit && !userId && (
              <div>
                <FormFieldLabel label="Staff member" required />
                <SelectDropdown
                  aria-label="Staff member"
                  placeholder="Select staff"
                  fullWidth
                  value={form.userId}
                  onValueChange={(value) => {
                    clearField('userId');
                    setForm((prev) => ({ ...prev, userId: value }));
                  }}
                  options={staffOptions}
                  className={fieldClassName('userId', 'w-full')}
                />
                <FormFieldError message={errors.userId} />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel label="Staff group" required />
                <SelectDropdown
                  aria-label="Staff group"
                  fullWidth
                  value={form.staffGroup}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, staffGroup: value as StaffGroup }))
                  }
                  options={GROUP_OPTIONS}
                />
              </div>
              <div>
                <FormFieldLabel label="Basic pay" required />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.basicSalary}
                  onChange={(e) => {
                    clearField('basicSalary');
                    setForm((prev) => ({ ...prev, basicSalary: e.target.value }));
                  }}
                  className={fieldClassName('basicSalary', modalFieldClassName)}
                />
                <FormFieldError message={errors.basicSalary} />
              </div>
            </div>

            <div>
              <FormFieldLabel label="Bank account number" />
              <input
                type="text"
                value={form.bankAccount}
                onChange={(e) => setForm((prev) => ({ ...prev, bankAccount: e.target.value }))}
                className={modalFieldClassName}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel label="EOBI" />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.eobi}
                  onChange={(e) => setForm((prev) => ({ ...prev, eobi: e.target.value }))}
                  className={modalFieldClassName}
                />
              </div>
              <div>
                <FormFieldLabel label="PESSI" />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.pessi}
                  onChange={(e) => setForm((prev) => ({ ...prev, pessi: e.target.value }))}
                  className={modalFieldClassName}
                />
              </div>
            </div>

            {form.staffGroup === 'visiting' ? (
              <div>
                <FormFieldLabel label="Rate per class" />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.ratePerClass}
                  onChange={(e) => setForm((prev) => ({ ...prev, ratePerClass: e.target.value }))}
                  className={modalFieldClassName}
                />
              </div>
            ) : (
              <div>
                <FormFieldLabel label="Extra lecture rate" />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.extraLecRate}
                  onChange={(e) => setForm((prev) => ({ ...prev, extraLecRate: e.target.value }))}
                  className={modalFieldClassName}
                />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel label="Effective from" required />
                <DateField
                  value={form.effectiveFrom}
                  onValueChange={(value) => {
                    clearField('effectiveFrom');
                    setForm((prev) => ({ ...prev, effectiveFrom: value }));
                  }}
                  className={fieldClassName('effectiveFrom', modalFieldClassName)}
                />
                <FormFieldError message={errors.effectiveFrom} />
              </div>
              <div>
                <FormFieldLabel label="Effective to" />
                <DateField
                  value={form.effectiveTo}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, effectiveTo: value }))}
                  className={modalFieldClassName}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-[var(--text-main-900)]">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              Active card (included when opening a month)
            </label>
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
              disabled={saveMutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save card' : 'Add card'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
