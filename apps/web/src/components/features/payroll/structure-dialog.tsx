'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  createSalaryStructureSchema,
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
import type { SalaryComponent, SalaryStructure } from './types';

const emptyComponent = (): SalaryComponent => ({
  kind: 'allowance',
  name: '',
  amount: 0,
  percentOfBasic: null,
});

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
    effectiveFrom: '',
    effectiveTo: '',
    isActive: true,
    components: [emptyComponent()] as SalaryComponent[],
  });

  useEffect(() => {
    if (!open) return;
    if (structure) {
      setForm({
        userId: structure.userId,
        basicSalary: String(structure.basicSalary),
        effectiveFrom: structure.effectiveFrom,
        effectiveTo: structure.effectiveTo ?? '',
        isActive: structure.isActive,
        components:
          structure.components.length > 0
            ? structure.components.map((c) => ({
                kind: c.kind,
                name: c.name,
                amount: c.amount,
                percentOfBasic: c.percentOfBasic,
              }))
            : [emptyComponent()],
      });
      return;
    }
    setForm({
      userId: userId ?? '',
      basicSalary: '',
      effectiveFrom: new Date().toISOString().slice(0, 10),
      effectiveTo: '',
      isActive: true,
      components: [emptyComponent()],
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
          body: JSON.stringify(payload),
        });
      }
      return apiClient('/payroll/structures', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      toast.success(isEdit ? 'Structure updated' : 'Structure created');
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
    const components = form.components
      .filter((c) => c.name.trim())
      .map((c) => ({
        kind: c.kind,
        name: c.name.trim(),
        amount: Number(c.amount) || 0,
        percentOfBasic:
          c.percentOfBasic != null && c.percentOfBasic !== ('' as unknown as number)
            ? Number(c.percentOfBasic)
            : null,
      }));

    if (isEdit) {
      return {
        basicSalary: Number(form.basicSalary),
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        isActive: form.isActive,
        components,
      };
    }

    return {
      userId: form.userId,
      branchId,
      basicSalary: Number(form.basicSalary),
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || null,
      isActive: form.isActive,
      components,
    };
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
            <DialogTitle>{isEdit ? 'Edit salary structure' : 'Add salary structure'}</DialogTitle>
            <DialogDescription className="mt-1">
              Define basic salary and allowance/deduction components
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
                <FormFieldLabel label="Basic salary (PKR)" required />
                <input
                  type="number"
                  min={0}
                  value={form.basicSalary}
                  onChange={(e) => {
                    clearField('basicSalary');
                    setForm((prev) => ({ ...prev, basicSalary: e.target.value }));
                  }}
                  className={fieldClassName('basicSalary', modalFieldClassName)}
                />
                <FormFieldError message={errors.basicSalary} />
              </div>
              <div>
                <FormFieldLabel label="Status" />
                <SelectDropdown
                  aria-label="Status"
                  fullWidth
                  value={form.isActive ? 'true' : 'false'}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, isActive: value === 'true' }))
                  }
                  options={[
                    { value: 'true', label: 'Active' },
                    { value: 'false', label: 'Inactive' },
                  ]}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormFieldLabel label="Effective from" required />
                <DateField
                  value={form.effectiveFrom}
                  onValueChange={(next) => {
                    clearField('effectiveFrom');
                    setForm((prev) => ({ ...prev, effectiveFrom: next }));
                  }}
                  className={fieldClassName('effectiveFrom', modalFieldClassName)}
                />
                <FormFieldError message={errors.effectiveFrom} />
              </div>
              <div>
                <FormFieldLabel label="Effective to" />
                <DateField
                  value={form.effectiveTo}
                  min={form.effectiveFrom || undefined}
                  onValueChange={(next) => {
                    clearField('effectiveTo');
                    setForm((prev) => ({ ...prev, effectiveTo: next }));
                  }}
                  className={fieldClassName('effectiveTo', modalFieldClassName)}
                />
                <FormFieldError message={errors.effectiveTo} />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <FormFieldLabel label="Components" />
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      components: [...prev.components, emptyComponent()],
                    }))
                  }
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--midnight-blue-950,#01366C)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
              <FormFieldError message={errors.components} />
              <div className="space-y-3">
                {form.components.map((component, index) => (
                  <div
                    key={index}
                    className="rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] p-3"
                  >
                    <div className="mb-2 grid gap-2 sm:grid-cols-2">
                      <SelectDropdown
                        aria-label="Component kind"
                        fullWidth
                        value={component.kind}
                        onValueChange={(value) => {
                          clearField(`components.${index}.kind`);
                          setForm((prev) => ({
                            ...prev,
                            components: prev.components.map((c, i) =>
                              i === index ? { ...c, kind: value as 'allowance' | 'deduction' } : c,
                            ),
                          }));
                        }}
                        options={[
                          { value: 'allowance', label: 'Allowance' },
                          { value: 'deduction', label: 'Deduction' },
                        ]}
                        className={fieldClassName(`components.${index}.kind`, 'w-full')}
                      />
                      <input
                        placeholder="Name"
                        value={component.name}
                        onChange={(e) => {
                          clearField(`components.${index}.name`);
                          setForm((prev) => ({
                            ...prev,
                            components: prev.components.map((c, i) =>
                              i === index ? { ...c, name: e.target.value } : c,
                            ),
                          }));
                        }}
                        className={fieldClassName(`components.${index}.name`, modalFieldClassName)}
                      />
                    </div>
                    <FormFieldError message={errors[`components.${index}.kind`]} />
                    <FormFieldError message={errors[`components.${index}.name`]} />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        type="number"
                        min={0}
                        placeholder="Fixed amount"
                        value={component.amount || ''}
                        onChange={(e) => {
                          clearField(`components.${index}.amount`);
                          setForm((prev) => ({
                            ...prev,
                            components: prev.components.map((c, i) =>
                              i === index ? { ...c, amount: Number(e.target.value) || 0 } : c,
                            ),
                          }));
                        }}
                        className={fieldClassName(`components.${index}.amount`, modalFieldClassName)}
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="% of basic (optional)"
                        value={component.percentOfBasic ?? ''}
                        onChange={(e) => {
                          clearField(`components.${index}.percentOfBasic`);
                          setForm((prev) => ({
                            ...prev,
                            components: prev.components.map((c, i) =>
                              i === index
                                ? {
                                    ...c,
                                    percentOfBasic: e.target.value ? Number(e.target.value) : null,
                                  }
                                : c,
                            ),
                          }));
                        }}
                        className={fieldClassName(
                          `components.${index}.percentOfBasic`,
                          modalFieldClassName,
                        )}
                      />
                    </div>
                    <FormFieldError message={errors[`components.${index}.amount`]} />
                    <FormFieldError message={errors[`components.${index}.percentOfBasic`]} />
                    {form.components.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            components: prev.components.filter((_, i) => i !== index),
                          }))
                        }
                        className="mt-2 inline-flex items-center gap-1 text-xs text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
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
              disabled={saveMutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {saveMutation.isPending ? 'Saving…' : isEdit ? 'Update structure' : 'Create structure'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
